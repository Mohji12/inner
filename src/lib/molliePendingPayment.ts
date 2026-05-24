const STORAGE_KEY = "ipd_pending_mollie_payment_id";

/** Call right before assigning window.location.href to Mollie's checkout URL. */
export function stashPendingMolliePaymentId(id: string): void {
  try {
    if (typeof sessionStorage !== "undefined" && id.trim()) {
      sessionStorage.setItem(STORAGE_KEY, id.trim());
    }
  } catch {
    /* ignore */
  }
}

export function peekPendingMolliePaymentId(): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const v = sessionStorage.getItem(STORAGE_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function clearPendingMolliePaymentId(): void {
  try {
    sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
