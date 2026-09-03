import { apiFetch, apiFetchBlob } from "./client";

export interface BookingInvoiceSummary {
  kind: "booking_session";
  booking_id: string;
  invoice_number: string;
  mentor_name: string;
  customer_name: string;
  customer_email: string;
  total_amount: string;
  currency: string;
  payment_status: string;
  duration_minutes: number;
  promo_applied: boolean;
  issued_at: string;
}

export interface BookingInvoice {
  kind: string;
  invoice_number: string;
  issued_at: string;
  platform_legal_name: string;
  platform_contact_email: string;
  booking_id: string;
  session_start_at_utc: string;
  session_end_at_utc: string;
  duration_minutes: number;
  booking_status: string;
  session_topic: string | null;
  bill_to_name: string;
  bill_to_email: string;
  mentor_name: string;
  mentor_email: string;
  line_description: string;
  payment_status: string;
  payment_currency: string;
  payment_amount: string;
  amount_base_eur: string | null;
  transaction_id: string | null;
}

export function listUserBookingInvoices(): Promise<BookingInvoiceSummary[]> {
  return apiFetch<BookingInvoiceSummary[]>("/invoices/bookings");
}

export function fetchUserBookingInvoice(bookingId: string): Promise<BookingInvoice> {
  return apiFetch<BookingInvoice>(`/invoices/bookings/${bookingId}`);
}

export function fetchMentorBookingInvoice(bookingId: string): Promise<BookingInvoice> {
  return apiFetch<BookingInvoice>(`/invoices/mentor/bookings/${bookingId}`);
}

export function downloadUserBookingInvoicePdf(bookingId: string) {
  return apiFetchBlob(`/invoices/${bookingId}/download`);
}

export function downloadMentorBookingInvoicePdf(bookingId: string) {
  return apiFetchBlob(`/invoices/mentor/${bookingId}/download`);
}

export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function saveUserBookingInvoicePdf(bookingId: string) {
  const { blob, filename } = await downloadUserBookingInvoicePdf(bookingId);
  triggerFileDownload(blob, filename ?? `invoice-${bookingId.slice(0, 8)}.pdf`);
}

export async function saveMentorBookingInvoicePdf(bookingId: string) {
  const { blob, filename } = await downloadMentorBookingInvoicePdf(bookingId);
  triggerFileDownload(blob, filename ?? `invoice-${bookingId.slice(0, 8)}-mentor.pdf`);
}
