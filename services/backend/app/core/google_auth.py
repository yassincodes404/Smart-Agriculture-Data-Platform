"""
core/google_auth.py
-------------------
Google OAuth 2.0 ID token verification for "Sign in with Google".
"""

import logging
from typing import Any

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import settings

logger = logging.getLogger(__name__)

# You should put your Google Client ID in .env.backend as GOOGLE_CLIENT_ID
# It must match the one used in the frontend.


def verify_google_token(token: str) -> dict[str, Any]:
    """
    Verify a Google ID token and return the payload.

    Raises:
        ValueError: if the token is invalid or audience doesn't match.
    """
    try:
        # Specify the CLIENT_ID of the app that accesses the backend.
        google_client_id = getattr(settings, "GOOGLE_CLIENT_ID", None)
        if not google_client_id:
            # In development you can skip strict audience check, but it's not recommended.
            logger.warning("GOOGLE_CLIENT_ID not set. Verifying without audience check (insecure for prod).")
            # Still verify signature
            request = google_requests.Request()
            idinfo = id_token.verify_oauth2_token(token, request)
        else:
            request = google_requests.Request()
            idinfo = id_token.verify_oauth2_token(
                token, request, audience=google_client_id
            )

        # ID token is valid. Get the user's Google Account information.
        return idinfo
    except ValueError as e:
        logger.warning(f"Invalid Google ID token: {e}")
        raise
    except Exception as e:
        logger.error(f"Error verifying Google token: {e}")
        raise ValueError("Failed to verify Google token") from e
