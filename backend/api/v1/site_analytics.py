from fastapi import APIRouter, Request, status

from api.deps import DbSession
from core.limiter import limiter
from schemas.site_analytics import PageViewAccepted, PageViewIn
from services.site_analytics_service import record_page_view

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/page-views", response_model=PageViewAccepted, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("60/minute")
def ingest_page_view(request: Request, payload: PageViewIn, db: DbSession) -> PageViewAccepted:
    record_page_view(
        db,
        path=payload.path,
        session_key=payload.session_key,
        referrer=payload.referrer,
        visitor_kind_raw=payload.visitor_kind,
    )
    return PageViewAccepted()
