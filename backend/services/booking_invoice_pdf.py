"""PDF generation for booking (session) invoices — ReportLab platypus."""

from io import BytesIO
from xml.sax.saxutils import escape as xml_escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from schemas.platform_invoice import BookingInvoiceOut
from services.invoice_pdf_fonts import style_with_invoice_font, table_font_names
from services.invoice_pdf_i18n import t_invoice
from services.pdf_branding import BRAND_NAME, brand_header_story, branded_pdf_callbacks


def _esc(value: object | None) -> str:
    if value is None:
        return ""
    return xml_escape(str(value), {"'": "&apos;", '"': "&quot;"})


def build_booking_invoice_pdf_from_out(data: BookingInvoiceOut, lang: str | None = None) -> bytes:
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
        ParagraphStyle(name="BkInvTitle", parent=styles["Heading1"], fontSize=18, spaceAfter=10),
        lang,
    )
    h2 = style_with_invoice_font(
        ParagraphStyle(name="BkInvH2", parent=styles["Heading2"], fontSize=11, spaceBefore=8, spaceAfter=4),
        lang,
    )
    body = style_with_invoice_font(styles["Normal"], lang)
    small = style_with_invoice_font(
        ParagraphStyle(name="BkInvSmall", parent=styles["Normal"], fontSize=9, textColor=colors.grey),
        lang,
    )

    story: list = []
    story.extend(brand_header_story())
    story.append(
        Paragraph(
            f"<b>{_esc(data.platform_legal_name or BRAND_NAME)} — {_esc(t_invoice(lang, 'invoice'))}</b>",
            title,
        )
    )
    story.append(
        Paragraph(
            f"<b>{_esc(data.invoice_number)}</b> &nbsp;|&nbsp; {_esc(t_invoice(lang, 'issued'))}: "
            f"{_esc(data.issued_at.strftime('%Y-%m-%d'))} "
            f"&nbsp;|&nbsp; {_esc(t_invoice(lang, 'payment'))}: <b>{_esc(data.payment_status)}</b>",
            body,
        )
    )
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph(f"<b>{_esc(t_invoice(lang, 'bill_to'))}</b>", h2))
    story.append(Paragraph(f"{_esc(data.bill_to_name)}<br/>{_esc(data.bill_to_email)}", body))
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph(f"<b>{_esc(t_invoice(lang, 'session'))}</b>", h2))
    story.append(
        Paragraph(
            f"{_esc(data.session_start_at_utc.strftime('%Y-%m-%d %H:%M UTC'))} → "
            f"{_esc(data.session_end_at_utc.strftime('%Y-%m-%d %H:%M UTC'))} "
            f"&nbsp;|&nbsp; {_esc(data.duration_minutes)} {_esc(t_invoice(lang, 'min_unit'))}<br/>"
            f"{_esc(t_invoice(lang, 'coach'))}: {_esc(data.mentor_name)} &lt;{_esc(data.mentor_email)}&gt;",
            body,
        )
    )
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph(f"<b>{_esc(t_invoice(lang, 'line_items'))}</b>", h2))
    table_data = [
        [t_invoice(lang, "description"), t_invoice(lang, "amount")],
        [data.line_description, f"{data.payment_amount} {data.payment_currency}"],
    ]
    table = Table(table_data, colWidths=[120 * mm, 45 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f4f5")),
                ("FONTNAME", (0, 0), (-1, 0), font_bold),
                ("FONTNAME", (0, 1), (-1, -1), font_reg),
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
            f"<b>{_esc(t_invoice(lang, 'total_due'))}:</b> {_esc(data.payment_amount)} {_esc(data.payment_currency)}",
            style_with_invoice_font(
                ParagraphStyle(name="Tot", parent=styles["Normal"], fontSize=12, spaceBefore=4),
                lang,
            ),
        )
    )
    if data.amount_base_eur:
        story.append(
            Paragraph(
                f"{_esc(t_invoice(lang, 'reference_eur_base'))}: {_esc(data.amount_base_eur)} EUR",
                small,
            )
        )
    if data.transaction_id:
        story.append(
            Paragraph(
                f"{_esc(t_invoice(lang, 'transaction_ref'))}: {_esc(data.transaction_id)}",
                small,
            )
        )

    story.append(Spacer(1, 10 * mm))
    story.append(
        Paragraph(
            f"{_esc(data.platform_legal_name)} · {_esc(data.platform_contact_email)}",
            style_with_invoice_font(
                ParagraphStyle(name="Foot", parent=styles["Normal"], fontSize=8, textColor=colors.grey),
                lang,
            ),
        )
    )
    story.append(
        Paragraph(
            f"<i>{_esc(t_invoice(lang, 'booking_id'))}: {_esc(data.booking_id)}</i>",
            small,
        )
    )

    doc.build(story, onFirstPage=on_first, onLaterPages=on_later)
    return buf.getvalue()
