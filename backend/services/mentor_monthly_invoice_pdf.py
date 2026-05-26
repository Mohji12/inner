"""Generate PDF bytes for mentor monthly fee invoices (admin view)."""

from decimal import Decimal
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape as xml_escape

from models.mentor import Mentor
from models.mentor_monthly_invoice import MentorMonthlyInvoice
from services.pdf_branding import BRAND_NAME, brand_header_story, branded_pdf_callbacks


def _esc(value: object | None) -> str:
    if value is None:
        return ""
    return xml_escape(str(value), {"'": "&apos;", '"': "&quot;"})


def build_mentor_monthly_invoice_pdf(*, invoice: MentorMonthlyInvoice, mentor: Mentor | None) -> bytes:
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
    title = ParagraphStyle(name="InvTitle", parent=styles["Heading1"], fontSize=18, spaceAfter=12)
    h2 = ParagraphStyle(name="InvH2", parent=styles["Heading2"], fontSize=11, spaceBefore=10, spaceAfter=6)
    body = styles["Normal"]

    month_label = invoice.invoice_month.isoformat() if invoice.invoice_month else "N/A"
    mentor_name = mentor.full_name if mentor else invoice.mentor_id
    mentor_email = mentor.email if mentor else "-"

    story: list = []
    story.extend(brand_header_story())
    story.append(Paragraph(f"<b>{BRAND_NAME} — Mentor Monthly Invoice {_esc(month_label)}</b>", title))
    story.append(
        Paragraph(
            f"Status: <b>{_esc(invoice.status)}</b> &nbsp;|&nbsp; Currency: <b>{_esc(invoice.currency)}</b>",
            body,
        )
    )
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph("<b>Mentor</b>", h2))
    story.append(Paragraph(f"{_esc(mentor_name)}<br/>{_esc(mentor_email)}", body))
    story.append(Spacer(1, 6 * mm))

    gross = Decimal(str(invoice.gross_revenue)).quantize(Decimal("0.01"))
    fee_pct = Decimal(str(invoice.fee_percent)).quantize(Decimal("0.01"))
    fee_amt = Decimal(str(invoice.fee_amount)).quantize(Decimal("0.01"))
    net = (gross - fee_amt).quantize(Decimal("0.01"))

    story.append(Paragraph("<b>Billing summary</b>", h2))
    table_data = [
        ["Month", "Gross Revenue", "Fee Percent", "Fee Amount", "Net Payout"],
        [month_label, f"{gross} {invoice.currency}", f"{fee_pct}%", f"{fee_amt} {invoice.currency}", f"{net} {invoice.currency}"],
    ]
    table = Table(table_data, colWidths=[34 * mm, 38 * mm, 30 * mm, 34 * mm, 34 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
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
    story.append(table)
    story.append(Spacer(1, 8 * mm))
    story.append(
        Paragraph(
            f"<i>Invoice id: {_esc(invoice.id)} &nbsp;|&nbsp; Mentor id: {_esc(invoice.mentor_id)}</i>",
            ParagraphStyle(name="Foot", parent=styles["Normal"], fontSize=8, textColor=colors.grey),
        )
    )

    doc.build(story, onFirstPage=on_first, onLaterPages=on_later)
    return buf.getvalue()
