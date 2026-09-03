import sys
import os
import uuid

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, engine
from backend import models

from models import email_otp  # noqa: F401 — register EmailOtpCode table

models.Base.metadata.create_all(bind=engine)

def seed():
    db = SessionLocal()
    
    # Initial mentors data from seed.ts
    mentors_data = [
        {
            "id": "mentor-1",
            "name": "Arjun Sharma",
            "email": "arjun@example.com",
            "phone": "+91 98765 43210",
            "city": "Varanasi",
            "expertise": "Vedic Astrology & Life Coaching",
            "bio": "Specializing in career and relationship harmony through ancient Vedic wisdom and modern coaching techniques.",
            "languages": ["English", "Hindi", "Sanskrit"],
            "yearsExperience": 12,
            "availability": ["Mon", "Tue", "Wed", "Thu", "Fri"],
            "sessionPrices": {10: 15, 20: 25, 30: 35}
        },
        {
            "id": "mentor-2",
            "name": "Sarah Van der Meer",
            "email": "sarah@example.com",
            "phone": "+31 6 1234 5678",
            "city": "Utrecht",
            "expertise": "Holistic Healing & Meditation",
            "bio": "Guided meditation and energy healing practices focusing on stress reduction and spiritual mindfulness.",
            "languages": ["Dutch", "English", "German"],
            "yearsExperience": 8,
            "availability": ["Mon", "Wed", "Sat", "Sun"],
            "sessionPrices": {10: 10, 20: 18, 30: 25}
        },
        {
            "id": "mentor-3",
            "name": "Dr. Elena Rossi",
            "email": "elena@example.com",
            "phone": "+39 02 123 4567",
            "city": "Florence",
            "expertise": "Classical Philosophy & Purpose Discovery",
            "bio": "Leveraging Stoic and Aristotelian principles to help professionals find deeper meaning and resilience in their paths.",
            "languages": ["Italian", "English", "French"],
            "yearsExperience": 15,
            "availability": ["Tue", "Thu", "Fri"],
            "sessionPrices": {10: 20, 20: 35, 30: 50}
        }
    ]

    for data in mentors_data:
        # Check if mentor already exists
        mentor = db.query(models.Mentor).filter(models.Mentor.id == data["id"]).first()
        if not mentor:
            db_mentor = models.Mentor(**data)
            db.add(db_mentor)
            print(f"Adding mentor: {data['name']}")
    
    db.commit()
    db.close()

if __name__ == "__main__":
    seed()
