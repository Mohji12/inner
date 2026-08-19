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

export function syncLatestWalletTopup(): Promise<Record<string, string>> {
  return apiFetch("/payments/sync-latest-wallet-topup", { method: "POST" });
}

export type WalletTopupIntent = {
  checkout_url: string;
  mollie_payment_id: string;
  amount: number | string;
  charge_amount?: number | string;
  transaction_fee?: number | string;
  currency: string;
};

export function createWalletTopupIntent(body: {
  amount: number;
  currency?: "EUR";
}): Promise<WalletTopupIntent> {
  return apiFetch("/payments/wallet/topup-intent", {
    method: "POST",
    body: JSON.stringify({
      amount: body.amount,
      currency: body.currency ?? "EUR",
      return_origin: typeof window !== "undefined" ? window.location.origin : null,
    }),
  });
}

export type PayBookingWithWalletResult = {
  checkout_url: string;
  payment_id: string;
  amount: number;
  currency: string;
  paid_from: "wallet";
};

export function payBookingWithWallet(body: {
  booking_id: string;
  promo_code?: string | null;
}): Promise<PayBookingWithWalletResult> {
  return apiFetch("/payments/pay-with-wallet", {
    method: "POST",
    body: JSON.stringify({
      booking_id: body.booking_id,
      promo_code: body.promo_code ?? null,
    }),
  });
}
