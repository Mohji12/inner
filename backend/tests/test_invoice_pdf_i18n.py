"""Unit tests for invoice PDF i18n catalogs."""

from services.invoice_pdf_i18n import (
    booking_line_description,
    invoice_lang,
    localize_payment_status,
    t_invoice,
)
from services.i18n_service import SUPPORTED_LANGS


def test_all_supported_langs_have_catalogs():
    for lang in SUPPORTED_LANGS:
        assert invoice_lang(lang) == lang
        assert t_invoice(lang, "invoice")


def test_dutch_and_french_labels():
    assert t_invoice("nl", "invoice") == "Factuur"
    assert t_invoice("fr", "invoice") == "Facture"
    assert t_invoice("de", "bill_to") == "Rechnung an"
    assert localize_payment_status("paid", "nl") == "betaald"
    assert localize_payment_status("paid", "fr") == "payé"


def test_booking_line_description_localized():
    nl = booking_line_description(lang="nl", duration_minutes=30, mentor_name="Ada")
    fr = booking_line_description(lang="fr", duration_minutes=30, mentor_name="Ada")
    assert "Coachsessie" in nl
    assert "mentorat" in fr.lower() or "Séance" in fr


def test_unknown_lang_falls_back_to_english_catalog():
    assert invoice_lang("xx") == "en"
    assert t_invoice("xx", "invoice") == "Invoice"
