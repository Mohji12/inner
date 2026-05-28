import { apiFetch, apiFetchBlob } from "./client";
import type { AdminCapabilityMatrixRow, AdminCommissionConfig, AdminPayoutApprovalRow } from "./types";

export type AdminPeriod = "day" | "week" | "month" | "year";

export interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

export interface AdminUserRow {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  account_status: string;
  email_verified: boolean;
  created_at: string;
}

export interface AdminMentorRow {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  headline: string | null;
  status: string;
  is_approved: boolean;
  email_verified: boolean;
  created_at: string;
}

export type MentorApprovalAction = "approve" | "reject";

export interface MentorApprovalUpdatePayload {
  action: MentorApprovalAction;
  reason?: string;
}

export interface AdminBookingRow {
  id: string;
  user_id: string;
  mentor_id: string;
  user_name: string;
  mentor_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  start_at_utc: string;
  end_at_utc: string;
  duration: number;
  status: string;
  payment_status: string;
  created_at: string;
}

export interface AdminPaymentRow {
  id: string;
  user_id: string;
  booking_id: string;
  amount: string;
  currency: string;
  status: string;
  payment_gateway: string;
  transaction_id: string | null;
  created_at: string;
}

export interface AdminReviewRow {
  id: string;
  user_id: string;
  mentor_id: string;
  user_name: string;
  mentor_name: string;
  booking_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
}

export interface DateCountPoint {
  date: string;
  count: number;
}

export interface DateAmountPoint {
  date: string;
  amount: string;
}

export interface AnalyticsResponse {
  period: AdminPeriod;
  range_start: string;
  range_end: string;
  summary: {
    bookings: number;
    new_users: number;
    new_mentors: number;
    reviews: number;
    revenue: string;
    total_users: number;
    total_mentors: number;
    total_payments: number;
    paid_payments: number;
    pending_payments: number;
  };
  bookings_by_day: DateCountPoint[];
  payments_by_day: DateAmountPoint[];
  reviews_by_day: DateCountPoint[];
  users_by_day: DateCountPoint[];
  mentors_by_day: DateCountPoint[];
}

export interface AdminChatInvoiceSummary {
  session_id: string;
  invoice_number: string;
  mentor_name: string;
  total_amount: string;
  currency: string;
  total_minutes_purchased: number;
  session_started_at: string;
  session_ended_at: string;
  issued_at: string;
}

export interface AdminChatInvoiceLine {
  id: string;
  minutes: number;
  amount: string;
  currency: string;
  status: string;
  transaction_id: string | null;
  created_at: string;
}

export interface AdminChatInvoiceConversationLine {
  id: string;
  sender_role: string;
  sender_display_name: string;
  body: string;
  created_at: string;
}

export interface AdminChatInvoiceDetail {
  invoice_number: string;
  issued_at: string;
  payment_status: string;
  session_id: string;
  session_status: string;
  session_started_at: string;
  session_ended_at: string;
  session_duration_seconds: number;
  total_minutes_purchased: number;
  total_amount: string;
  currency: string;
  bill_to_name: string;
  bill_to_email: string;
  bill_to_phone: string | null;
  service_provider_name: string;
  service_provider_email: string;
  line_items: AdminChatInvoiceLine[];
  conversation: AdminChatInvoiceConversationLine[];
}

export interface AdminSettlementCandidateRow {
  mentor_id: string;
  mentor_name: string;
  currency: string;
  gross_amount: string;
  fee_amount: string;
  net_amount: string;
  item_count: number;
}

export interface AdminSettlementCandidateList {
  cycle_start: string;
  cycle_end: string;
  candidates: AdminSettlementCandidateRow[];
}

export interface AdminSettlementRow {
  id: string;
  mentor_id: string;
  mentor_name: string;
  currency: string;
  cycle_start: string;
  cycle_end: string;
  gross_amount: string;
  fee_amount: string;
  net_amount: string;
  status: string;
  provider_batch_ref: string | null;
  failure_reason: string | null;
  paid_at: string | null;
  created_at: string;
  /** True when coach has Mollie Connect tokens and payouts enabled (DB snapshot). */
  connect_payout_ready: boolean;
  connect_payout_blocked_reason: string | null;
}

export interface AdminSettlementItemRow {
  id: string;
  source_type: string;
  source_id: string;
  amount: string;
  created_at: string;
}

export interface AdminSettlementDetail extends AdminSettlementRow {
  items: AdminSettlementItemRow[];
}

export interface AdminSettlementList {
  items: AdminSettlementRow[];
  total: number;
  skip: number;
  limit: number;
}

export interface AdminWalletAdjustPayload {
  amount: number;
  reason: string;
  reference_type?: string;
  reference_id?: string;
}

export interface AdminWalletAdjustResponse {
  wallet_id: string;
  user_id: string;
  balance: string;
  transaction_id: string;
  transaction_type: string;
  amount: string;
  created_at: string;
}

export interface AdminWalletUserAnalyticsRow {
  user_id: string;
  user_name: string;
  user_email: string;
  currency: string;
  credited_total: string;
  debited_total: string;
  net_total: string;
  transaction_count: number;
  last_transaction_at: string | null;
}

export interface AdminWalletAnalyticsResponse {
  items: AdminWalletUserAnalyticsRow[];
  total_credited: string;
  total_debited: string;
  total_net: string;
}

export interface AdminMentorPayoutAccount {
  mentor_id: string;
  provider_name: string;
  provider_account_ref: string;
  status: string;
  verified_at: string | null;
}

export interface AdminMentorMonthlyInvoiceRow {
  id: string;
  mentor_id: string;
  mentor_name: string;
  invoice_month: string;
  gross_revenue: string;
  fee_percent: string;
  fee_amount: string;
  currency: string;
  status: string;
  mollie_checkout_url: string | null;
  paid_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
}

export interface AdminMentorMonthlyInvoiceList {
  items: AdminMentorMonthlyInvoiceRow[];
  total: number;
  skip: number;
  limit: number;
}

function qs(params: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function fetchAdminUsers(skip = 0, limit = 50, q?: string) {
  return apiFetch<Paginated<AdminUserRow>>(`/admin/users${qs({ skip, limit, q })}`);
}

export function fetchAdminMentors(skip = 0, limit = 50, q?: string) {
  return apiFetch<Paginated<AdminMentorRow>>(`/admin/mentors${qs({ skip, limit, q })}`);
}

export function updateMentorApproval(mentorId: string, payload: MentorApprovalUpdatePayload) {
  return apiFetch<AdminMentorRow>(`/admin/mentors/${mentorId}/approval`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminBookings(skip = 0, limit = 50) {
  return apiFetch<Paginated<AdminBookingRow>>(`/admin/bookings${qs({ skip, limit })}`);
}

export function fetchAdminPayments(skip = 0, limit = 50) {
  return apiFetch<Paginated<AdminPaymentRow>>(`/admin/payments${qs({ skip, limit })}`);
}

export function fetchAdminReviews(skip = 0, limit = 50) {
  return apiFetch<Paginated<AdminReviewRow>>(`/admin/reviews${qs({ skip, limit })}`);
}

export function fetchAdminAnalytics(period: AdminPeriod) {
  return apiFetch<AnalyticsResponse>(`/admin/analytics${qs({ period })}`);
}

export function fetchAdminChatInvoices() {
  return apiFetch<AdminChatInvoiceSummary[]>("/admin/chat-invoices");
}

export function fetchAdminChatInvoice(sessionId: string) {
  return apiFetch<AdminChatInvoiceDetail>(`/admin/chat-invoices/${sessionId}`);
}

export function downloadAdminChatInvoicePdf(sessionId: string) {
  return apiFetchBlob(`/admin/chat-invoices/${sessionId}/pdf`);
}

export function fetchAdminSettlementCandidates(cycleEnd?: string) {
  return apiFetch<AdminSettlementCandidateList>(`/admin/settlements/candidates${qs({ cycle_end: cycleEnd })}`);
}

export function generateAdminSettlements(payload: { cycle_start?: string; cycle_end?: string }) {
  return apiFetch<AdminSettlementList>("/admin/settlements/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminSettlements(skip = 0, limit = 50) {
  return apiFetch<AdminSettlementList>(`/admin/settlements${qs({ skip, limit })}`);
}

export function fetchAdminSettlement(id: string) {
  return apiFetch<AdminSettlementDetail>(`/admin/settlements/${id}`);
}

export function approveAdminSettlement(id: string) {
  return apiFetch<AdminSettlementRow>(`/admin/settlements/${id}/approve`, { method: "POST" });
}

export function payAdminSettlement(id: string, idempotencyKey?: string) {
  return apiFetch<AdminSettlementRow>(`/admin/settlements/${id}/pay`, {
    method: "POST",
    body: JSON.stringify({ idempotency_key: idempotencyKey }),
  });
}

export function markAdminSettlementPaid(id: string) {
  return apiFetch<AdminSettlementRow>(`/admin/settlements/${id}/mark-paid`, { method: "POST" });
}

export function adminCreditUserWallet(userId: string, payload: AdminWalletAdjustPayload) {
  return apiFetch<AdminWalletAdjustResponse>(`/admin/wallets/${userId}/credit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminDebitUserWallet(userId: string, payload: AdminWalletAdjustPayload) {
  return apiFetch<AdminWalletAdjustResponse>(`/admin/wallets/${userId}/debit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminWalletAnalytics() {
  return apiFetch<AdminWalletAnalyticsResponse>("/admin/wallets/analytics");
}

export function upsertMentorPayoutAccount(
  mentorId: string,
  payload: { provider_name: string; provider_account_ref: string; status?: string },
) {
  return apiFetch<AdminMentorPayoutAccount>(`/admin/mentors/${mentorId}/payout-account`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminMentorMonthlyInvoices(skip = 0, limit = 50) {
  return apiFetch<AdminMentorMonthlyInvoiceList>(`/admin/mentor-monthly-invoices${qs({ skip, limit })}`);
}

export function regenerateAdminMentorMonthlyInvoiceLink(invoiceId: string) {
  return apiFetch<AdminMentorMonthlyInvoiceRow>(`/admin/mentor-monthly-invoices/${invoiceId}/regenerate-link`, {
    method: "POST",
  });
}

export function markAdminMentorMonthlyInvoiceReminder(invoiceId: string) {
  return apiFetch<AdminMentorMonthlyInvoiceRow>(`/admin/mentor-monthly-invoices/${invoiceId}/mark-reminder`, {
    method: "POST",
  });
}

export function downloadAdminMentorMonthlyInvoicePdf(invoiceId: string) {
  return apiFetchBlob(`/admin/mentor-monthly-invoices/${invoiceId}/pdf`);
}

export function getAdminMarketplaceCommission(currency = "EUR") {
  return apiFetch<AdminCommissionConfig>(`/marketplace/commission/current?currency=${encodeURIComponent(currency)}`);
}

export function updateAdminMarketplaceCommission(payload: {
  percent: number;
  currency?: string;
  effective_from?: string;
}) {
  return apiFetch<AdminCommissionConfig>("/marketplace/commission", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listAdminMarketplaceCapabilities() {
  return apiFetch<AdminCapabilityMatrixRow[]>("/marketplace/capabilities");
}

export function upsertAdminMarketplaceCapability(payload: {
  country_code: string;
  entity_type: string;
  currency: string;
  supports_connect: boolean;
  supports_payouts: boolean;
  supports_transfers: boolean;
  notes?: string;
}) {
  return apiFetch<AdminCapabilityMatrixRow>("/marketplace/capabilities", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listAdminMarketplacePayoutRequests(status?: string) {
  return apiFetch<AdminPayoutApprovalRow[]>(`/marketplace/payouts${qs({ status })}`);
}

export function approveAdminMarketplacePayout(payoutId: string) {
  return apiFetch<AdminPayoutApprovalRow>(`/marketplace/payouts/${payoutId}/approve`, { method: "POST" });
}

export function executeAdminMarketplacePayout(payoutId: string) {
  return apiFetch<AdminPayoutApprovalRow>(`/marketplace/payouts/${payoutId}/execute`, { method: "POST" });
}

export function releaseAdminCoachPendingToWithdrawable(mentorId: string, amount: number, currency = "EUR") {
  return apiFetch<{ mentor_id: string; released_amount: string; currency: string }>(
    `/marketplace/coaches/${mentorId}/release-pending${qs({ amount, currency })}`,
    { method: "POST" },
  );
}

export interface AdminMentorBankDetailsPrivate {
  mentor_id: string;
  has_bank_details: boolean;
  account_holder_name: string | null;
  iban: string | null;
  bic: string | null;
  status: string;
  provider_name: string;
  provider_account_ref: string;
  verified_at: string | null;
  updated_at: string | null;
}

/** Full IBAN for manual transfers — admin only. */
export function getAdminMentorPayoutBankDetails(mentorId: string) {
  return apiFetch<AdminMentorBankDetailsPrivate>(`/admin/mentors/${mentorId}/payout-bank-details`);
}

export interface AdminBookingInvoiceRow {
  booking_id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  mentor_name: string;
  total_amount: string;
  currency: string;
  payment_status: string;
  duration_minutes: number;
  issued_at: string;
}

export interface AdminBookingInvoiceList {
  items: AdminBookingInvoiceRow[];
  total: number;
  skip: number;
  limit: number;
}

export interface AdminOnboardingInvoiceRow {
  payment_id: string;
  invoice_number: string;
  mentor_name: string;
  mentor_email: string;
  total_amount: string;
  currency: string;
  payment_status: string;
  issued_at: string;
}

export interface AdminOnboardingInvoiceList {
  items: AdminOnboardingInvoiceRow[];
  total: number;
  skip: number;
  limit: number;
}

export interface AdminTransactionRow {
  id: string;
  transaction_type: string;
  reference_id: string | null;
  party_name: string;
  party_email: string | null;
  amount: string;
  currency: string;
  status: string;
  created_at: string;
}

export interface AdminTransactionList {
  items: AdminTransactionRow[];
  total: number;
  skip: number;
  limit: number;
}

export function fetchAdminBookingInvoices(skip = 0, limit = 50) {
  return apiFetch<AdminBookingInvoiceList>(`/admin/booking-invoices?skip=${skip}&limit=${limit}`);
}

export function downloadAdminBookingInvoicePdf(bookingId: string) {
  return apiFetchBlob(`/admin/booking-invoices/${bookingId}/pdf`);
}

export function fetchAdminOnboardingInvoices(skip = 0, limit = 50) {
  return apiFetch<AdminOnboardingInvoiceList>(`/admin/onboarding-invoices?skip=${skip}&limit=${limit}`);
}

export function fetchAdminTransactions(skip = 0, limit = 100) {
  return apiFetch<AdminTransactionList>(`/admin/transactions?skip=${skip}&limit=${limit}`);
}
