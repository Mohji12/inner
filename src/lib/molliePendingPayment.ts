import { safeLocalStorage } from "@/lib/safeStorage";

const STORAGE_KEY = "ipd_pending_mollie_payment_id";

/** Call right before assigning window.location.href to Mollie's checkout URL. */
export function stashPendingMolliePaymentId(id: string): void {
  const value = id.trim();
  if (!value) return;
  safeLocalStorage.setItem(STORAGE_KEY, value);
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function peekPendingMolliePaymentId(): string | null {
  try {
    const fromSession = sessionStorage.getItem(STORAGE_KEY)?.trim();
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  const fromLocal = safeLocalStorage.getItem(STORAGE_KEY)?.trim();
  return fromLocal || null;
}

export function clearPendingMolliePaymentId(): void {
  safeLocalStorage.removeItem(STORAGE_KEY);
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
