"""Shared Mijn Levenspad logo + watermark for ReportLab invoice PDFs."""

from __future__ import annotations

import logging
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import Image, Spacer

logger = logging.getLogger(__name__)

BRAND_NAME = "Mijn Levenspad"
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_REPO_ROOT = _BACKEND_ROOT.parent

LOGO_CANDIDATES: tuple[Path, ...] = (
    _BACKEND_ROOT / "assets" / "branding" / "mijn-levenspad-logo.png",
    _REPO_ROOT / "public" / "lifepath logo.png",
    _REPO_ROOT / "public" / "lifepath%20logo.png",
)


def resolve_brand_logo_path() -> Path | None:
    for candidate in LOGO_CANDIDATES:
        if candidate.is_file():
            return candidate
    return None


def brand_logo_flowable(*, max_width_mm: float = 48, max_height_mm: float = 16):
    path = resolve_brand_logo_path()
    if not path:
        logger.warning("Brand logo not found for invoice PDF; checked: %s", LOGO_CANDIDATES)
        return None
    try:
        img = Image(str(path))
    except Exception:
        logger.exception("Failed to load brand logo from %s", path)
        return None
    iw, ih = float(img.imageWidth), float(img.imageHeight)
    if iw <= 0 or ih <= 0:
        return None
    max_w, max_h = max_width_mm * mm, max_height_mm * mm
    scale = min(max_w / iw, max_h / ih, 1.0)
    img.drawWidth = iw * scale
    img.drawHeight = ih * scale
    img.hAlign = "LEFT"
    return img


def brand_header_story(*, spacer_mm: float = 4) -> list:
    logo = brand_logo_flowable()
    if not logo:
        return []
    return [logo, Spacer(1, spacer_mm * mm)]


def draw_pdf_watermark(canvas, watermark_text: str = BRAND_NAME) -> None:
    w, h = A4
    canvas.saveState()
    path = resolve_brand_logo_path()
    if path:
        try:
            canvas.setFillAlpha(0.07)
            logo_size = min(w, h) * 0.55
            canvas.drawImage(
                str(path),
                w / 2 - logo_size / 2,
                h / 2 - logo_size / 2,
                width=logo_size,
                height=logo_size,
                preserveAspectRatio=True,
                mask="auto",
            )
        except Exception:
            logger.exception("Failed to draw watermark logo on invoice PDF")
    canvas.setFillAlpha(0.09)
    canvas.setFillColor(colors.HexColor("#6b7358"))
    canvas.setFont("Helvetica-Bold", 44)
    canvas.translate(w / 2, h / 2)
    canvas.rotate(42)
    canvas.drawCentredString(0, 0, watermark_text)
    canvas.restoreState()


def branded_pdf_page_callback(canvas, doc) -> None:
    draw_pdf_watermark(canvas)


def branded_pdf_callbacks() -> tuple:
    fn = branded_pdf_page_callback
    return fn, fn
