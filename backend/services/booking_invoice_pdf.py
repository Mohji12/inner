"""PDF generation for booking (session) invoices — ReportLab platypus."""

from io import BytesIO
from xml.sax.saxutils import escape as xml_escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from schemas.platform_invoice import BookingInvoiceOut


def _esc(value: object | None) -> str:
    if value is None:
        return ""
    return xml_escape(str(value), {"'": "&apos;", '"': "&quot;"})


def build_booking_invoice_pdf_from_out(data: BookingInvoiceOut) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle(name="BkInvTitle", parent=styles["Heading1"], fontSize=18, spaceAfter=10)
    h2 = ParagraphStyle(name="BkInvH2", parent=styles["Heading2"], fontSize=11, spaceBefore=8, spaceAfter=4)
    body = styles["Normal"]
    small = ParagraphStyle(name="BkInvSmall", parent=styles["Normal"], fontSize=9, textColor=colors.grey)

    story: list = []
    story.append(Paragraph(f"<b>{_esc(data.platform_legal_name)} — Invoice</b>", title))
    story.append(
        Paragraph(
            f"<b>{_esc(data.invoice_number)}</b> &nbsp;|&nbsp; Issued: {_esc(data.issued_at.strftime('%Y-%m-%d'))} "
            f"&nbsp;|&nbsp; Payment: <b>{_esc(data.payment_status)}</b>",
            body,
        )
    )
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("<b>Bill to</b>", h2))
    story.append(Paragraph(f"{_esc(data.bill_to_name)}<br/>{_esc(data.bill_to_email)}", body))
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("<b>Session</b>", h2))
    story.append(
        Paragraph(
            f"{_esc(data.session_start_at_utc.strftime('%Y-%m-%d %H:%M UTC'))} → "
            f"{_esc(data.session_end_at_utc.strftime('%Y-%m-%d %H:%M UTC'))} "
            f"&nbsp;|&nbsp; {_esc(data.duration_minutes)} min<br/>"
            f"Coach: {_esc(data.mentor_name)} &lt;{_esc(data.mentor_email)}&gt;",
            body,
        )
    )
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("<b>Line items</b>", h2))
    table_data = [
        ["Description", "Amount"],
        [data.line_description, f"{data.payment_amount} {data.payment_currency}"],
    ]
    table = Table(table_data, colWidths=[120 * mm, 45 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f4f5")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(table)

    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            f"<b>Total due:</b> {_esc(data.payment_amount)} {_esc(data.payment_currency)}",
            ParagraphStyle(name="Tot", parent=styles["Normal"], fontSize=12, spaceBefore=4),
        )
    )
    if data.amount_base_eur:
        story.append(Paragraph(f"Reference EUR base: {_esc(data.amount_base_eur)} EUR", small))
    if data.transaction_id:
        story.append(Paragraph(f"Transaction ref: {_esc(data.transaction_id)}", small))

    story.append(Spacer(1, 10 * mm))
    story.append(
        Paragraph(
            f"{_esc(data.platform_legal_name)} · {_esc(data.platform_contact_email)}",
            ParagraphStyle(name="Foot", parent=styles["Normal"], fontSize=8, textColor=colors.grey),
        )
    )
    story.append(Paragraph(f"<i>Booking id: {_esc(data.booking_id)}</i>", small))

    doc.build(story)
    return buf.getvalue()
