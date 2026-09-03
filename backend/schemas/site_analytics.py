from pydantic import BaseModel, Field


class PageViewIn(BaseModel):
    path: str = Field(min_length=1, max_length=255)
    session_key: str = Field(min_length=8, max_length=36)
    referrer: str | None = Field(default=None, max_length=512)
    visitor_kind: str | None = Field(default=None, max_length=16)


class PageViewAccepted(BaseModel):
    ok: bool = True


class TopPageRow(BaseModel):
    path: str
    views: int
    unique_visitors: int


class ReferrerRow(BaseModel):
    host: str
    views: int
    unique_visitors: int
