"""
app/api/ai.py
--------------
AI endpoints:
  POST   /ai/keys                      — add a Groq API key
  GET    /ai/keys                      — list user's keys (masked)
  DELETE /ai/keys/{key_id}             — remove a key
  PATCH  /ai/keys/{key_id}/toggle      — enable/disable a key
  
  GET    /ai/lands/{land_id}/chat      — get chat history for a land
  POST   /ai/lands/{land_id}/chat      — send a message to AI
  DELETE /ai/lands/{land_id}/chat      — clear chat history
  
  GET    /ai/lands/{land_id}/insights  — get stored AI insights
  POST   /ai/lands/{land_id}/analyze   — trigger a fresh AI analysis
"""

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.security import require_land_access
from app.ai import repository as ai_repo
from app.ai.groq_client import GroqClient
from app.ai.land_analyst import build_chat_system_message, run_ai_land_analysis

logger = logging.getLogger(__name__)
router = APIRouter(tags=["ai"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class AddKeyRequest(BaseModel):
    api_key: str
    label: Optional[str] = None
    provider: str = "groq"


class ChatMessageRequest(BaseModel):
    message: str


class ToggleKeyRequest(BaseModel):
    is_active: bool


# ---------------------------------------------------------------------------
# API Key Management
# ---------------------------------------------------------------------------

@router.get("/ai/keys")
def list_api_keys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all API keys (masked) for the current user."""
    client = GroqClient(db, current_user.user_id)
    return {"keys": client.get_key_pool_status()}


@router.post("/ai/keys", status_code=status.HTTP_201_CREATED)
def add_api_key(
    body: AddKeyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new Groq API key for the current user."""
    if not body.api_key or len(body.api_key.strip()) < 8:
        raise HTTPException(status_code=400, detail="Invalid API key format.")
    row = ai_repo.create_key(
        db,
        user_id=current_user.user_id,
        api_key=body.api_key.strip(),
        label=body.label,
        provider=body.provider,
    )
    return {"key_id": row.key_id, "label": row.label, "message": "API key added successfully."}


@router.delete("/ai/keys/{key_id}", status_code=status.HTTP_200_OK)
def delete_api_key(
    key_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a specific API key."""
    deleted = ai_repo.delete_key(db, key_id=key_id, user_id=current_user.user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="API key not found.")
    return {"message": "API key deleted."}


@router.patch("/ai/keys/{key_id}/toggle")
def toggle_api_key(
    key_id: int,
    body: ToggleKeyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enable or disable a specific API key."""
    row = ai_repo.toggle_key(db, key_id=key_id, user_id=current_user.user_id, is_active=body.is_active)
    if not row:
        raise HTTPException(status_code=404, detail="API key not found.")
    return {"key_id": row.key_id, "is_active": row.is_active}


# ---------------------------------------------------------------------------
# AI Chat Endpoints
# ---------------------------------------------------------------------------

@router.get("/ai/lands/{public_id}/chat")
def get_chat_history(
    public_id: str,
    land = Depends(require_land_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the full chat history for a land."""
    session = ai_repo.get_or_create_session(db, land_id=land.land_id, user_id=current_user.user_id)
    messages = ai_repo.list_messages(db, session_id=session.session_id)
    return {
        "session_id": session.session_id,
        "land_id": land.land_id,
        "messages": [
            {
                "message_id": m.message_id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.post("/ai/lands/{public_id}/chat")
def send_chat_message(
    public_id: str,
    body: ChatMessageRequest,
    land = Depends(require_land_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send a message to the AI about a specific land.
    Stores both user message and AI reply in the database.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # Get or create session
    session = ai_repo.get_or_create_session(db, land_id=land.land_id, user_id=current_user.user_id)

    # Store user message
    ai_repo.add_message(db, session_id=session.session_id, role="user", content=body.message)

    # Build conversation history for Groq (last 20 messages for context)
    history = ai_repo.list_messages(db, session_id=session.session_id)
    conversation_messages = [
        {"role": "system", "content": build_chat_system_message(land.land_id, db)}
    ]
    for m in history[-20:]:
        conversation_messages.append({"role": m.role, "content": m.content})

    # Query Groq
    client = GroqClient(db, current_user.user_id)
    response = client.chat(conversation_messages, max_tokens=1024, temperature=0.4)

    if not response:
        # No keys available
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable. Please add a valid Groq API key in your profile settings."
        )

    try:
        reply_content = response["choices"][0]["message"]["content"]
        tokens_used = response.get("usage", {}).get("total_tokens")
    except (KeyError, IndexError) as exc:
        logger.error("Unexpected Groq response format: %s", exc)
        raise HTTPException(status_code=502, detail="Unexpected response from AI service.")

    # Store AI reply
    reply_msg = ai_repo.add_message(
        db,
        session_id=session.session_id,
        role="assistant",
        content=reply_content,
        tokens_used=tokens_used,
    )

    return {
        "session_id": session.session_id,
        "message_id": reply_msg.message_id,
        "role": "assistant",
        "content": reply_content,
        "tokens_used": tokens_used,
    }


@router.delete("/ai/lands/{public_id}/chat")
def clear_chat_history(
    public_id: str,
    land = Depends(require_land_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear all messages in the chat session for this land."""
    session = ai_repo.get_or_create_session(db, land_id=land.land_id, user_id=current_user.user_id)
    ai_repo.clear_session(db, session_id=session.session_id, user_id=current_user.user_id)
    return {"message": "Chat history cleared."}


# ---------------------------------------------------------------------------
# AI Insights Endpoints
# ---------------------------------------------------------------------------

@router.get("/ai/lands/{public_id}/insights")
def get_ai_insights(
    public_id: str,
    land = Depends(require_land_access),
    db: Session = Depends(get_db),
):
    """Get all AI-generated insights for a land (no auth required to read)."""
    insights = ai_repo.get_insights_for_land(db, land_id=land.land_id)
    return {
        "land_id": land.land_id,
        "insights": [
            {
                "insight_id": ins.insight_id,
                "insight_type": ins.insight_type,
                "title": ins.title,
                "body": ins.body,
                "structured_data": ins.structured_data,
                "confidence": ins.confidence,
                "model_used": ins.model_used,
                "created_at": ins.created_at.isoformat(),
            }
            for ins in insights
        ],
    }


@router.post("/ai/lands/{public_id}/analyze")
def trigger_ai_analysis(
    public_id: str,
    land = Depends(require_land_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger a fresh AI analysis for a land synchronously."""
    insights = run_ai_land_analysis(land_id=land.land_id, db=db, user_id=current_user.user_id)
    if not insights:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="AI Quota Finished or Analysis Failed.")
    return {"message": "AI analysis complete.", "insights": True}
