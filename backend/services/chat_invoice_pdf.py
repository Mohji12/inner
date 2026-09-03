"""Generate PDF bytes for a chat invoice (ReportLab)."""

from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape as xml_escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core.chat_states import CHAT_SENDER_USER
from models.chat_message import ChatMessage
from models.chat_purchase import ChatPurchase
from models.chat_session import ChatSession
from models.mentor import Mentor
from models.user import User
from services.chat_invoice_service import aggregate_purchases
from services.pdf_branding import BRAND_NAME, brand_header_story, branded_pdf_callbacks


def _fmt_dt(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M UTC")


def _wall_seconds(session: ChatSession) -> int:
    ca = session.created_at
    ua = session.updated_at
    if ca.tzinfo is None:
        ca = ca.replace(tzinfo=timezone.utc)
    if ua.tzinfo is None:
        ua = ua.replace(tzinfo=timezone.utc)
    return max(0, int((ua - ca).total_seconds()))


def _fmt_duration(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h:
        return f"{h}h {m}m {s}s"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"


def _esc(s: str | None) -> str:
    if s is None:
        return ""
    return xml_escape(str(s), {"'": "&apos;", '"': "&quot;"})


def build_chat_invoice_pdf(
    *,
    invoice_number: str,
    session: ChatSession,
    user: User,
    mentor: Mentor,
    purchases: list[ChatPurchase],
    messages: list[ChatMessage] | None = None,
) -> bytes:
    total, minutes, currency = aggregate_purchases(purchases)
    issued = max(p.created_at for p in purchases)
    wall_s = _wall_seconds(session)
    messages = messages or []

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
    story: list = []
    story.extend(brand_header_story())
    story.append(Paragraph(f"<b>{BRAND_NAME} — Invoice {_esc(invoice_number)}</b>", title))
    story.append(
        Paragraph(
            f"Issued: {_esc(_fmt_dt(issued))} &nbsp;|&nbsp; Payment: <b>paid</b>",
            body,
        )
    )
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph("<b>Bill to</b>", h2))
    story.append(Paragraph(f"{_esc(user.full_name)}<br/>{_esc(user.email)}<br/>{_esc(user.phone_number)}", body))
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("<b>Service provider</b>", h2))
    story.append(Paragraph(f"{_esc(mentor.full_name)}<br/>{_esc(mentor.email)}", body))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("<b>Session</b>", h2))
    story.append(
        Paragraph(
            f"Minutes purchased (total): <b>{minutes} min</b><br/>"
            f"Session window: <b>{_esc(_fmt_duration(wall_s))}</b><br/>"
            f"{_esc(_fmt_dt(session.created_at))} to {_esc(_fmt_dt(session.updated_at))}",
            body,
        )
    )
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("<b>Line items</b>", h2))
    table_data = [["Minutes", "Amount", "Reference", "Date"]]
    for p in purchases:
        table_data.append(
            [
                str(p.minutes),
                f"{Decimal(str(p.amount)).quantize(Decimal('0.01'))} {p.currency}",
                _esc(p.transaction_id or "—"),
                _fmt_dt(p.created_at),
            ]
        )
    t = Table(table_data, colWidths=[22 * mm, 38 * mm, 52 * mm, 52 * mm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph("<b>Conversation transcript</b>", h2))
    msg_style = ParagraphStyle(
        name="MsgTrans",
        parent=body,
        fontSize=8,
        leading=10,
        spaceAfter=4,
    )
    if not messages:
        story.append(Paragraph("<i>No messages were exchanged in this session.</i>", body))
    else:
        for m in messages:
            role_label = "User" if m.sender_role == CHAT_SENDER_USER else "Mentor"
            who = user.full_name if m.sender_role == CHAT_SENDER_USER else mentor.full_name
            body_html = _esc(m.body).replace("\n", "<br/>")
            story.append(
                Paragraph(
                    f"<b>[{_esc(_fmt_dt(m.created_at))}] {_esc(role_label)} ({_esc(who)})</b><br/>{body_html}",
                    msg_style,
                )
            )
    story.append(Spacer(1, 8 * mm))

    total_str = str(total.quantize(Decimal("0.01")))
    story.append(
        Paragraph(
            f"<b>Total due: {_esc(total_str)} {_esc(currency)}</b>",
            ParagraphStyle(name="Total", parent=styles["Normal"], fontSize=12, textColor=colors.black),
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            f"<i>Paid text chat - session {_esc(session.id)}</i>",
            ParagraphStyle(name="Foot", parent=styles["Normal"], fontSize=8, textColor=colors.grey),
        )
    )

    doc.build(story, onFirstPage=on_first, onLaterPages=on_later)
    return buf.getvalue()
