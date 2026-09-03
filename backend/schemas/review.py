from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    review_text: str | None = None
    review_text_i18n: dict[str, str] | None = None


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    mentor_id: str
    booking_id: str
    rating: int
    review_text: str | None
    created_at: datetime
