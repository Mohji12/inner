import pyotp
import qrcode
import io
import base64
from typing import Tuple

class TwoFactorService:
    @staticmethod
    def generate_secret() -> str:
        """Generates a random 32-character base32 secret."""
        return pyotp.random_base32()

    @staticmethod
    def get_provisioning_uri(email: str, secret: str, issuer_name: str = "Inner Path") -> str:
        """Returns the otpauth:// URI to be encoded in a QR code."""
        return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer_name)

    @staticmethod
    def generate_qr_code_base64(provisioning_uri: str) -> str:
        """Generates a QR code image as a base64 string."""
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode()

    @staticmethod
    def verify_otp(secret: str, code: str) -> bool:
        """Verifies a TOTP code against the secret."""
        totp = pyotp.totp.TOTP(secret)
        return totp.verify(code)

two_factor_service = TwoFactorService()
