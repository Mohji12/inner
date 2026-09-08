"""Generate PDF bytes for coach settlement invoices (admin + coach download)."""

from decimal import Decimal
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape as xml_escape

from models.mentor import Mentor
from models.mentor_settlement import MentorSettlement, MentorSettlementItem
from services.invoice_pdf_fonts import style_with_invoice_font, table_font_names
from services.invoice_pdf_i18n import t_invoice
from services.pdf_branding import BRAND_NAME, brand_header_story, branded_pdf_callbacks


def _esc(value: object | None) -> str:
    if value is None:
        return ""
    return xml_escape(str(value), {"'": "&apos;", '"': "&quot;"})


def settlement_invoice_number(settlement: MentorSettlement) -> str:
    end = settlement.cycle_end.isoformat().replace("-", "") if settlement.cycle_end else "NA"
    return f"SETL-{end}-{settlement.id[:8].upper()}"


def build_settlement_invoice_pdf(
    *,
    settlement: MentorSettlement,
    mentor: Mentor | None,
    items: list[MentorSettlementItem],
    lang: str | None = None,
) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=22 * mm,
        bottomMargin=18 * mm,
    )
    on_first, on_later = branded_pdf_callbacks()
    styles = getSampleStyleSheet()
    font_reg, font_bold = table_font_names(lang)
    title = style_with_invoice_font(
        ParagraphStyle(name="InvTitle", parent=styles["Heading1"], fontSize=18, spaceAfter=12),
        lang,
    )
    h2 = style_with_invoice_font(
        ParagraphStyle(name="InvH2", parent=styles["Heading2"], fontSize=11, spaceBefore=10, spaceAfter=6),
        lang,
    )
    body = style_with_invoice_font(styles["Normal"], lang)
    foot = style_with_invoice_font(
        ParagraphStyle(name="Foot", parent=styles["Normal"], fontSize=8, textColor=colors.grey),
        lang,
    )

    inv_no = settlement_invoice_number(settlement)
    mentor_name = mentor.full_name if mentor else settlement.mentor_id
    mentor_email = mentor.email if mentor else "-"
    mentor_kvk = mentor.kvk_number if mentor and mentor.kvk_number else "—"
    cycle = f"{settlement.cycle_start.isoformat()} → {settlement.cycle_end.isoformat()}"

    story: list = []
    story.extend(brand_header_story())
    story.append(
        Paragraph(
            f"<b>{BRAND_NAME} — {_esc(t_invoice(lang, 'settlement_invoice'))}</b>",
            title,
        )
    )
    story.append(
        Paragraph(
            f"{_esc(t_invoice(lang, 'invoice'))}: <b>{_esc(inv_no)}</b> &nbsp;|&nbsp; "
            f"{_esc(t_invoice(lang, 'status'))}: <b>{_esc(settlement.status)}</b> "
            f"&nbsp;|&nbsp; {_esc(t_invoice(lang, 'currency'))}: <b>{_esc(settlement.currency)}</b>",
            body,
        )
    )
    story.append(Paragraph(f"{_esc(t_invoice(lang, 'cycle'))}: <b>{_esc(cycle)}</b>", body))
    if settlement.paid_at:
        story.append(
            Paragraph(
                f"{_esc(t_invoice(lang, 'paid_at'))}: {_esc(settlement.paid_at.isoformat())}",
                body,
            )
        )
    if settlement.provider_batch_ref:
        story.append(
            Paragraph(
                f"{_esc(t_invoice(lang, 'provider_reference'))}: {_esc(settlement.provider_batch_ref)}",
                body,
            )
        )
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph(f"<b>{_esc(t_invoice(lang, 'coach'))}</b>", h2))
    story.append(
        Paragraph(
            f"{_esc(mentor_name)}<br/>{_esc(mentor_email)}<br/>KVK: {_esc(mentor_kvk)}",
            body,
        )
    )
    story.append(Spacer(1, 6 * mm))

    gross = Decimal(str(settlement.gross_amount)).quantize(Decimal("0.01"))
    fee = Decimal(str(settlement.fee_amount)).quantize(Decimal("0.01"))
    net = Decimal(str(settlement.net_amount)).quantize(Decimal("0.01"))

    story.append(Paragraph(f"<b>{_esc(t_invoice(lang, 'settlement_summary'))}</b>", h2))
    summary = Table(
        [
            [t_invoice(lang, "gross"), t_invoice(lang, "fee"), t_invoice(lang, "net_payout")],
            [f"{gross} {settlement.currency}", f"{fee} {settlement.currency}", f"{net} {settlement.currency}"],
        ],
        colWidths=[55 * mm, 55 * mm, 55 * mm],
    )
    summary.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
                ("FONTNAME", (0, 0), (-1, 0), font_bold),
                ("FONTNAME", (0, 1), (-1, -1), font_reg),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(summary)
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph(f"<b>{_esc(t_invoice(lang, 'line_items'))}</b>", h2))
    if not items:
        story.append(Paragraph(_esc(t_invoice(lang, "no_line_items")), body))
    else:
        rows = [
            [
                t_invoice(lang, "col_num"),
                t_invoice(lang, "source"),
                t_invoice(lang, "source_id"),
                t_invoice(lang, "amount"),
            ]
        ]
        for idx, item in enumerate(items, start=1):
            amt = Decimal(str(item.amount)).quantize(Decimal("0.01"))
            rows.append(
                [
                    str(idx),
                    str(item.source_type),
                    str(item.source_id)[:12] + ("…" if len(str(item.source_id)) > 12 else ""),
                    f"{amt} {settlement.currency}",
                ]
            )
        lines = Table(rows, colWidths=[12 * mm, 40 * mm, 70 * mm, 40 * mm])
        lines.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
                    ("FONTNAME", (0, 0), (-1, 0), font_bold),
                    ("FONTNAME", (0, 1), (-1, -1), font_reg),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(lines)

    story.append(Spacer(1, 10 * mm))
    story.append(
        Paragraph(
            f"<i>{_esc(t_invoice(lang, 'settlement_footer', settlement_id=settlement.id, mentor_id=settlement.mentor_id))}</i>",
            foot,
        )
    )

    doc.build(story, onFirstPage=on_first, onLaterPages=on_later)
    return buf.getvalue()
