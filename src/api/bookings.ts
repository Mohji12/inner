import { apiFetch } from "./client";
import type { Booking, PaymentOut, ReviewOut } from "./types";

export interface BookingCreateBody {
  slot_id?: string;
  mentor_id?: string;
  duration_minutes?: number;
  session_topic?: string | null;
  problem_description?: string | null;
  goals_expected?: string | null;
  experience_level?: string | null;
  communication_mode?: string | null;
  urgency_level?: string | null;
  preferred_language?: string | null;
  attachments?: unknown[] | null;
}

export type BookingPatchBody = Partial<{
  status: string;
  notes_by_user: string | null;
  notes_by_mentor: string | null;
}>;

export function createBooking(body: BookingCreateBody): Promise<Booking> {
  return apiFetch<Booking>("/bookings", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listUserBookings(): Promise<Booking[]> {
  return apiFetch<Booking[]>("/bookings/me");
}

export function listMentorBookings(): Promise<Booking[]> {
  return apiFetch<Booking[]>("/bookings/mentor/me");
}

export function getUserBooking(bookingId: string): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${bookingId}`);
}

export function patchBookingAsUser(bookingId: string, body: BookingPatchBody): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${bookingId}/as-user`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function patchBookingAsMentor(bookingId: string, body: BookingPatchBody): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${bookingId}/as-mentor`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function payBooking(bookingId: string): Promise<PaymentOut> {
  return apiFetch<PaymentOut>(`/bookings/${bookingId}/pay`, { method: "POST" });
}

export interface ReviewCreateBody {
  rating: number;
  review_text?: string | null;
}

export function createBookingReview(bookingId: string, body: ReviewCreateBody): Promise<ReviewOut> {
  return apiFetch<ReviewOut>(`/bookings/${bookingId}/review`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function rescheduleBooking(bookingId: string, newSlotId: string): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(`/bookings/${bookingId}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ new_slot_id: newSlotId }),
  });
}

export function getBookingCalendarUrl(bookingId: string): string {
  // Return the full URL for the download link
  return `${import.meta.env.VITE_API_URL || ""}/api/v1/bookings/${bookingId}/ical`;
}

export type CreatePaymentIntentOptions = {
  promo_code?: string | null;
  checkout_currency?: string;
};

export function createPaymentIntent(
  bookingId: string,
  opts?: CreatePaymentIntentOptions,
): Promise<{ checkout_url: string; payment_id: string; amount: number; currency: string }> {
  return apiFetch(`/payments/create-intent`, {
    method: "POST",
    body: JSON.stringify({
      booking_id: bookingId,
      promo_code: opts?.promo_code ?? null,
      checkout_currency: opts?.checkout_currency ?? null,
    }),
  });
}

export function validatePromoCode(
  code: string,
  amount: number,
  mentorId?: string,
): Promise<{
  is_valid: boolean;
  discount_amount: number;
  session_amount: number;
  transaction_fee: number;
  final_amount: number;
  message?: string;
}> {
  return apiFetch(`/promo-codes/validate`, {
    method: "POST",
    body: JSON.stringify({ code, amount, mentor_id: mentorId || null }),
  });
}

export function getInvoiceDownloadUrl(bookingId: string): string {
  return `${import.meta.env.VITE_API_URL || ""}/api/v1/invoices/${bookingId}/download`;
}

export function getMentorInvoiceDownloadUrl(bookingId: string): string {
  return `${import.meta.env.VITE_API_URL || ""}/api/v1/invoices/mentor/${bookingId}/download`;
}
