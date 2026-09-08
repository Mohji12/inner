"""Unicode-capable fonts for localized invoice PDFs."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont

from services.invoice_pdf_i18n import invoice_lang

logger = logging.getLogger(__name__)

_WIN_FONTS = Path(r"C:\Windows\Fonts")
_LINUX_FONTS = (
    Path("/usr/share/fonts/truetype/dejavu"),
    Path("/usr/share/fonts/truetype/liberation"),
    Path("/usr/share/fonts/truetype/noto"),
)


def _candidate_pairs(*, for_cjk: bool) -> list[tuple[str, Path, Path | None]]:
    pairs: list[tuple[str, Path, Path | None]] = []
    if for_cjk:
        pairs.extend(
            [
                ("InvoiceCJK", _WIN_FONTS / "msyh.ttc", _WIN_FONTS / "msyhbd.ttc"),
                ("InvoiceCJK", _WIN_FONTS / "simsun.ttc", None),
                ("InvoiceCJK", Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"), None),
                ("InvoiceCJK", Path("/usr/share/fonts/truetype/noto/NotoSansSC-Regular.otf"), None),
            ]
        )
    pairs.extend(
        [
            ("InvoiceUnicode", _WIN_FONTS / "arial.ttf", _WIN_FONTS / "arialbd.ttf"),
            ("InvoiceUnicode", _WIN_FONTS / "segoeui.ttf", _WIN_FONTS / "segoeuib.ttf"),
        ]
    )
    for root in _LINUX_FONTS:
        pairs.append(("InvoiceUnicode", root / "DejaVuSans.ttf", root / "DejaVuSans-Bold.ttf"))
        pairs.append(
            ("InvoiceUnicode", root / "LiberationSans-Regular.ttf", root / "LiberationSans-Bold.ttf")
        )
        pairs.append(("InvoiceUnicode", root / "NotoSans-Regular.ttf", root / "NotoSans-Bold.ttf"))
    return pairs


def _ensure_registered(family: str, regular: Path, bold: Path | None) -> tuple[str, str] | None:
    if not regular.is_file():
        return None
    reg_name = family
    bold_name = f"{family}-Bold"
    registered = set(pdfmetrics.getRegisteredFontNames())
    try:
        if reg_name not in registered:
            reg_kwargs = {"subfontIndex": 0} if regular.suffix.lower() == ".ttc" else {}
            pdfmetrics.registerFont(TTFont(reg_name, str(regular), **reg_kwargs))
        if bold and bold.is_file():
            if bold_name not in registered and bold_name not in set(pdfmetrics.getRegisteredFontNames()):
                bold_kwargs = {"subfontIndex": 0} if bold.suffix.lower() == ".ttc" else {}
                pdfmetrics.registerFont(TTFont(bold_name, str(bold), **bold_kwargs))
        else:
            bold_name = reg_name
        registerFontFamily(family, normal=reg_name, bold=bold_name)
        return reg_name, bold_name
    except Exception:
        logger.exception("Failed to register invoice PDF font from %s", regular)
        return None


@lru_cache(maxsize=8)
def invoice_pdf_font_names(lang: str | None = None) -> tuple[str, str]:
    """Return (regular, bold) ReportLab font names for the invoice language."""
    code = invoice_lang(lang)
    for family, regular, bold in _candidate_pairs(for_cjk=(code == "zh")):
        registered = _ensure_registered(family, regular, bold)
        if registered:
            return registered
    return "Helvetica", "Helvetica-Bold"


def style_with_invoice_font(style: ParagraphStyle, lang: str | None, *, bold: bool = False) -> ParagraphStyle:
    """Clone a ParagraphStyle onto the Unicode invoice font."""
    regular, bold_name = invoice_pdf_font_names(lang)
    return ParagraphStyle(
        name=f"{style.name}_i18n",
        parent=style,
        fontName=bold_name if bold else regular,
    )


def table_font_names(lang: str | None) -> tuple[str, str]:
    return invoice_pdf_font_names(lang)
