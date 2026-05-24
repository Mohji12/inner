from typing import Optional, Dict, Any
from google.oauth2 import id_token
from google.auth.transport import requests
from core.config import settings

class SocialAuthService:
    @staticmethod
    def verify_google_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Verifies a Google ID token.
        Returns the decoded payload if valid, else None.
        """
        try:
            # If settings.google_client_id is not set, we can't verify.
            # In a real dev environment, you'd use a real client ID.
            if not settings.google_client_id:
                # For development/demo purposes, we might want a bypass or dummy validation
                # But for production-ready code, we must verify.
                return None
            
            idinfo = id_token.verify_oauth2_token(
                token, 
                requests.Request(), 
                settings.google_client_id
            )

            # ID token is valid. Get the user's Google ID from the 'sub' claim.
            return idinfo
        except Exception as e:
            print(f"Google token verification failed: {e}")
            return None

social_auth_service = SocialAuthService()
