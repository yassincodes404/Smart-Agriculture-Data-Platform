"""
app/ai/land_analyst.py
-----------------------
Builds rich agricultural context from the database and sends it to Groq
for expert analysis. Results are stored as LandAiInsight rows.

Called from:
  - land_discovery_pipeline (Step 7, after crop detection)
  - The /ai/lands/{land_id}/analyze endpoint (on demand)
"""

from __future__ import annotations

import json
import logging
import base64
from typing import Optional

from sqlalchemy.orm import Session

from app.ai.groq_client import GroqClient
from app.models.land import Land
from app.models.land_ai_insight import LandAiInsight

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# System prompt — the agronomist persona for Groq
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_PERSONA = """You are AgriMind, an expert AI agricultural analyst specializing in multimodal remote sensing, 
precision farming, and crop health assessment. You have deep expertise in:
- Visual interpretation of True Color and NDVI satellite imagery
- Multi-spectral indices: NDVI (health), EVI (biomass), NDWI (water stress), SAVI (soil adjustment), GNDVI (chlorophyll)
- Soil health assessment and irrigation scheduling
- Crop disease and stress detection
- Egyptian and North African agricultural conditions

When analyzing farm data, provide:
1. Clear, actionable insights a farmer can act on TODAY
2. Specific numbers and thresholds, not vague statements
3. Cross-reference visual anomalies in satellite imagery with numerical spectral data
4. Risk flags if anything looks anomalous
5. Your confidence level in the assessment
"""

SYSTEM_PROMPT_JSON = """
Always respond in structured JSON format as specified by the user prompt.
"""


# ---------------------------------------------------------------------------
# Context builder
# ---------------------------------------------------------------------------

def _build_land_context(land_id: int, db: Session) -> dict:
    """Fetch all relevant data for a land and return as a structured dict."""
    from app.lands import repository as land_repo

    land = db.query(Land).filter(Land.land_id == land_id).first()
    if not land:
        return {}

    context = {
        "land": {
            "name": land.name,
            "latitude": float(land.latitude),
            "longitude": float(land.longitude),
            "area_hectares": float(land.area_hectares) if land.area_hectares else None,
            "status": land.status,
        },
        "spectral_history": [],
        "recent_climate": [],
        "recent_soil": [],
        "crop_zones": [],
    }

    # Spectral history (up to 180 days)
    try:
        crops = land_repo.list_land_crop_rows(db, land_id)
        for c in crops[-60:]:  # Up to 60 observations (approx 180 days if every 3 days)
            context["spectral_history"].append({
                "date": c.timestamp.strftime("%Y-%m-%d"),
                "ndvi": round(float(c.ndvi_value), 4) if c.ndvi_value else None,
                "dvi": round(float(c.dvi_value), 4) if getattr(c, "dvi_value", None) else None,
                "evi": round(float(c.evi_value), 4) if getattr(c, "evi_value", None) else None,
                "ndwi": round(float(c.ndwi_value), 4) if getattr(c, "ndwi_value", None) else None,
                "savi": round(float(c.savi_value), 4) if getattr(c, "savi_value", None) else None,
                "gndvi": round(float(c.gndvi_value), 4) if getattr(c, "gndvi_value", None) else None,
                "stage": c.growth_stage,
                "trend": c.ndvi_trend,
            })
    except Exception as exc:
        logger.warning("Could not fetch spectral history for AI context: %s", exc)

    # Recent climate (last 30 days)
    try:
        climate = land_repo.list_land_climate_rows(db, land_id)
        for c in climate[-30:]:
            context["recent_climate"].append({
                "date": c.timestamp.strftime("%Y-%m-%d"),
                "temp_c": float(c.temperature_celsius) if c.temperature_celsius else None,
                "humidity_pct": float(c.humidity_pct) if c.humidity_pct else None,
                "rainfall_mm": float(c.rainfall_mm) if c.rainfall_mm else None,
            })
    except Exception as exc:
        logger.warning("Could not fetch climate for AI context: %s", exc)

    # Recent soil (last 30 readings)
    try:
        soil = land_repo.list_land_soil_rows(db, land_id)
        for s in soil[-15:]:
            context["recent_soil"].append({
                "date": s.timestamp.strftime("%Y-%m-%d"),
                "moisture_pct": float(s.moisture_pct) if s.moisture_pct else None,
                "ph": float(s.ph_level) if s.ph_level else None,
                "organic_matter_pct": float(s.organic_matter_pct) if s.organic_matter_pct else None,
            })
    except Exception as exc:
        logger.warning("Could not fetch soil for AI context: %s", exc)

    # Crop zones
    try:
        from app.models.crop_zone import CropZone
        zones = db.query(CropZone).filter(CropZone.land_id == land_id).all()
        for z in zones:
            context["crop_zones"].append({
                "crop_type": z.crop_type,
                "area_pct": float(z.area_pct) if z.area_pct else None,
                "avg_ndvi": float(z.latest_ndvi) if z.latest_ndvi else None,
                "growth_stage": z.latest_growth_stage,
                "confidence": float(z.avg_confidence) if z.avg_confidence else None,
            })
    except Exception as exc:
        logger.warning("Could not fetch crop zones for AI context: %s", exc)

    return context


# ---------------------------------------------------------------------------
# Analysis runner
# ---------------------------------------------------------------------------

def run_ai_land_analysis(land_id: int, db: Session, user_id: Optional[int] = None) -> list[LandAiInsight]:
    """
    Main entry point: fetch land context, send to Groq, store insights.
    Returns list of created LandAiInsight rows.

    If user_id is None, uses the land's owner user_id.
    """
    # Resolve user_id
    if user_id is None:
        land = db.query(Land).filter(Land.land_id == land_id).first()
        if land:
            user_id = land.user_id
    if not user_id:
        logger.warning("No user_id for AI analysis of land_id=%s — skipping", land_id)
        return []

    context = _build_land_context(land_id, db)
    if not context:
        logger.warning("Empty context for land_id=%s — skipping AI analysis", land_id)
        return []

    client = GroqClient(db, user_id)

    # Delete previous auto-generated insights for this land to keep them fresh
    db.query(LandAiInsight).filter(LandAiInsight.land_id == land_id).delete()
    db.flush()

    insights_created = []

    # ---- Insight 1: Overall Crop & NDVI Analysis ----
    insight = _request_insight(
        client=client,
        land_id=land_id,
        db=db,
        insight_type="crop_analysis",
        title_fallback="AI Crop Health Analysis",
        prompt=f"""Analyze this farm data and return ONLY valid JSON (no markdown, no extra text):
{{
  "title": "short headline max 10 words",
  "summary": "2-3 sentence expert analysis of crop health based on NDVI trends",
  "ndvi_assessment": "excellent|good|fair|poor|critical",
  "key_observations": ["observation 1", "observation 2", "observation 3"],
  "recommended_action": "specific action the farmer should take now",
  "risk_flags": ["risk 1 if any"],
  "confidence": 0.0
}}

Farm data:
{json.dumps(context, indent=2)}"""
    )
    if insight:
        insights_created.append(insight)

    # ---- Insight 2: Irrigation & Water Advice ----
    if context.get("recent_soil") or context.get("recent_climate"):
        insight = _request_insight(
            client=client,
            land_id=land_id,
            db=db,
            insight_type="irrigation_advice",
            title_fallback="AI Irrigation Assessment",
            prompt=f"""Based on this farm's soil moisture and climate data, return ONLY valid JSON:
{{
  "title": "short headline max 10 words",
  "summary": "2-3 sentence irrigation assessment",
  "irrigation_status": "adequate|needed_soon|overdue|excessive",
  "recommended_water_mm": 0.0,
  "next_irrigation_days": 0,
  "key_observations": ["observation 1", "observation 2"],
  "confidence": 0.0
}}

Farm data (focus on soil moisture and climate):
{json.dumps({"soil": context.get("recent_soil", []), "climate": context.get("recent_climate", []), "land": context.get("land", {})}, indent=2)}"""
        )
        if insight:
            insights_created.append(insight)

    # ---- Insight 3: Harvest Timing (if crop zones present) ----
    if context.get("crop_zones") and context.get("spectral_history"):
        insight = _request_insight(
            client=client,
            land_id=land_id,
            db=db,
            insight_type="harvest_timing",
            title_fallback="AI Harvest Timing Estimate",
            prompt=f"""Based on the NDVI progression and crop type data, return ONLY valid JSON:
{{
  "title": "short headline max 10 words",
  "summary": "2-3 sentence harvest timing analysis covering all detected crops",
  "key_observations": ["observation 1 (e.g. Alfalfa readiness)", "observation 2 (e.g. Wheat is overdue/harvested)"],
  "recommended_action": "e.g. Harvest Alfalfa now, wait for Wheat",
  "confidence": 0.0
}}

Ensure your analysis handles the MULTI-CROP nature of the farm. Evaluate each crop independently.

Farm data:
{json.dumps({"crop_zones": context.get("crop_zones", []), "spectral_history": context.get("spectral_history", [])[-15:], "land": context.get("land", {})}, indent=2)}"""
        )
        if insight:
            insights_created.append(insight)

    # ---- Insight 4: Multi-Spectral & Vision Analysis ----
    images_payload = []
    try:
        from app.models.land_image import LandImage
        recent_images = db.query(LandImage).filter(LandImage.land_id == land_id).order_by(LandImage.timestamp.desc()).limit(2).all()
        for img in recent_images:
            if img.image_data:
                b64_str = base64.b64encode(img.image_data).decode('utf-8')
                mime_type = "image/png" if "png" in (img.image_type or "").lower() else "image/jpeg"
                images_payload.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime_type};base64,{b64_str}"
                    }
                })
    except Exception as e:
        logger.warning("Could not fetch images for AI context: %s", e)

    insight = _request_insight(
        client=client,
        land_id=land_id,
        db=db,
        insight_type="vision_analysis",
        title_fallback="Advanced Multi-Spectral & Visual Analysis",
        prompt=f"""You have been provided with up to 180 days of multi-spectral index history (NDVI, EVI, GNDVI, NDWI, SAVI) AND the most recent satellite images of the farm (if attached).
        
Cross-reference the numerical indices (e.g. is EVI showing strong biomass but NDWI showing water stress?) with any visual anomalies you can spot in the attached satellite images (e.g. uneven crop growth, dry patches, or boundary issues).

Return ONLY valid JSON:
{{
  "title": "short headline max 10 words",
  "summary": "3-4 sentence comprehensive multimodal analysis",
  "spectral_assessment": "excellent|good|fair|poor|critical",
  "key_observations": ["observation 1", "observation 2", "observation 3"],
  "recommended_action": "specific multi-spectral or visual-based recommendation",
  "risk_flags": ["risk 1 if any"],
  "confidence": 0.0
}}

Farm Data (Spectral History & Crop Zones):
{json.dumps({"spectral_history": context.get("spectral_history", []), "crop_zones": context.get("crop_zones", [])}, indent=2)}""",
        images=images_payload if images_payload else None
    )
    if insight:
        insights_created.append(insight)

    db.commit()
    logger.info("AI analysis complete for land_id=%s — %d insights created", land_id, len(insights_created))
    return insights_created


def _request_insight(
    client: GroqClient,
    land_id: int,
    db: Session,
    insight_type: str,
    title_fallback: str,
    prompt: str,
    images: Optional[list[dict]] = None
) -> Optional[LandAiInsight]:
    """Send one insight prompt to Groq and store the result."""
    
    if images:
        content_array = [{"type": "text", "text": prompt}]
        for img in images:
            content_array.append(img)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_PERSONA + SYSTEM_PROMPT_JSON},
            {"role": "user", "content": content_array},
        ]
    else:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT_PERSONA + SYSTEM_PROMPT_JSON},
            {"role": "user", "content": prompt},
        ]
        
    response = client.chat(messages, max_tokens=800, temperature=0.2)
    if not response:
        return None

    try:
        raw_content = response["choices"][0]["message"]["content"]
        model_used = response.get("model", "llama-3.3-70b-versatile")
        tokens = response.get("usage", {}).get("total_tokens")

        # Parse JSON from Groq's response (clean markdown if present)
        import re
        cleaned_content = re.sub(r"```(?:json)?|```", "", raw_content).strip()
        
        structured = None
        body = raw_content
        try:
            structured = json.loads(cleaned_content)
            title = structured.get("title", title_fallback)
            body = structured.get("summary", raw_content)
            confidence = structured.get("confidence")
        except json.JSONDecodeError:
            title = title_fallback
            confidence = None

        insight = LandAiInsight(
            land_id=land_id,
            insight_type=insight_type,
            title=title,
            body=body,
            structured_data=structured,
            confidence=confidence,
            model_used=model_used,
        )
        db.add(insight)
        db.flush()
        return insight

    except (KeyError, IndexError) as exc:
        logger.warning("Failed to parse Groq response for insight_type=%s: %s", insight_type, exc)
        return None


# ---------------------------------------------------------------------------
# Chat helper — builds context-aware chat messages
# ---------------------------------------------------------------------------

def build_chat_system_message(land_id: int, db: Session) -> str:
    """Build a system message with current farm context for the chat interface."""
    context = _build_land_context(land_id, db)
    context_json = json.dumps(context, indent=2)

    # Keep context under ~4000 chars to avoid huge token costs
    if len(context_json) > 4000:
        # Truncate older history, keep most recent
        if "spectral_history" in context:
            context["spectral_history"] = context["spectral_history"][-10:]
        if "recent_climate" in context:
            context["recent_climate"] = context["recent_climate"][-10:]
        if "recent_soil" in context:
            context["recent_soil"] = context["recent_soil"][-5:]
        context_json = json.dumps(context, indent=2)

    return f"""{SYSTEM_PROMPT_PERSONA}

You are in a live chat interface directly with the farmer. Respond naturally in conversational markdown (NOT JSON).
Location: {context.get('land', {}).get('latitude')}°N, {context.get('land', {}).get('longitude')}°E
Area: {context.get('land', {}).get('area_hectares')} hectares

Live Farm Data Context:
{context_json}

Answer the farmer's questions based on this specific farm data. Be concise, practical, and use the real numbers from the data.
If you notice something critical in the data, proactively flag it."""
