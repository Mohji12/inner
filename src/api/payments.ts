import { apiFetch } from "./client";

export async function getCheckoutCurrencies(): Promise<string[]> {
  const r = await apiFetch<{ currencies: string[] }>("/payments/checkout-currencies", { skipAuth: true });
  return r.currencies;
}

export type BookingCheckoutPreview = {
  session_amount_eur: number;
  transaction_fee_eur: number;
  total_eur: number;
};

export function getBookingCheckoutPreview(bookingId: string): Promise<BookingCheckoutPreview> {
  return apiFetch(`/payments/booking-checkout-preview?booking_id=${encodeURIComponent(bookingId)}`);
}

/** Finalize booking/chat after Mollie redirect when webhookUrl cannot reach your API (e.g. SPA-only host). */
export function syncMolliePaymentAfterCheckout(mollie_payment_id: string): Promise<Record<string, string>> {
  return apiFetch("/payments/sync-mollie-payment", {
    method: "POST",
    body: JSON.stringify({ mollie_payment_id }),
  });
}
