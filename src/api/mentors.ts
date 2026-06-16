import { apiFetch, apiFetchBlob } from "./client";
import type {
  AvailabilitySlot,
  CoachConnectStatus,
  CoachPayoutRequestRow,
  CoachWalletBalances,
  MentorAccount,
  MentorDetail,
  MentorPublic,
  PlatformPricing,
} from "./types";

export type MentorPatchBody = Partial<{
  full_name: string;
  country_code: string | null;
  timezone: string | null;
  profile_image: string | null;
  banner_image: string | null;
  headline: string | null;
  bio: string | null;
  languages_spoken: unknown[] | null;
  years_of_experience: number | null;
  current_company: string | null;
  previous_companies: unknown[] | null;
  education: unknown[] | null;
  certifications: unknown[] | null;
  expertise_areas: unknown[] | null;
  skills: unknown[] | null;
  tools_technologies: unknown[] | null;
  session_modes: unknown[] | null;
  chat_price_per_minute: string | null;
  chat_currency: string | null;
  chat_min_purchase_minutes: number | null;
}>;

export interface SlotCreateBody {
  slot_date?: string;
  start_time?: string;
  end_time?: string;
  start_local?: string;
  end_local?: string;
  timezone?: string | null;
  slot_duration: number;
  is_recurring?: boolean;
}

export type SlotPatchBody = Partial<{
  slot_date: string;
  start_time: string;
  end_time: string;
  start_local: string;
  end_local: string;
  timezone: string | null;
  slot_duration: number;
  is_recurring: boolean;
}>;

import { MentorSearchParams } from "../components/MentorSearchFilters";

export function listMentors(approvedOnly = true, filters?: MentorSearchParams): Promise<MentorPublic[]> {
  const sp = new URLSearchParams();
  if (approvedOnly) sp.set("approved_only", "true");
  else sp.set("approved_only", "false");
  
  if (filters) {
    if (filters.q) sp.set("q", filters.q);
    if (filters.languages && filters.languages.length > 0) {
      filters.languages.forEach((l) => sp.append("languages", l));
    }
    if (filters.minPrice !== undefined) sp.set("min_price", filters.minPrice.toString());
    if (filters.maxPrice !== undefined) sp.set("max_price", filters.maxPrice.toString());
    if (filters.minRating !== undefined) sp.set("min_rating", filters.minRating.toString());
    if (filters.sortBy) sp.set("sort_by", filters.sortBy);
  }
  
  const q = sp.toString() ? `?${sp.toString()}` : "";
  return apiFetch<MentorPublic[]>(`/mentors${q}`, { skipAuth: true });
}

export function getMentor(mentorId: string): Promise<MentorDetail> {
  return apiFetch<MentorDetail>(`/mentors/${mentorId}`, { skipAuth: true });
}

export function getPlatformPricing(): Promise<PlatformPricing> {
  return apiFetch<PlatformPricing>("/mentors/pricing", { skipAuth: true });
}

export function getSimilarMentors(mentorId: string, limit: number = 4): Promise<MentorPublic[]> {
  return apiFetch<MentorPublic[]>(`/mentors/${mentorId}/similar?limit=${limit}`, { skipAuth: true });
}

export function getMentorSlots(
  mentorId: string,
  params?: { from?: string; to?: string },
): Promise<AvailabilitySlot[]> {
  const sp = new URLSearchParams();
  if (params?.from) sp.set("from", params.from);
  if (params?.to) sp.set("to", params.to);
  const q = sp.toString();
  return apiFetch<AvailabilitySlot[]>(`/mentors/${mentorId}/slots${q ? `?${q}` : ""}`, {
    skipAuth: true,
  });
}

export function getMentorMe(): Promise<MentorAccount> {
  return apiFetch<MentorAccount>("/mentors/me");
}

export function heartbeatMentorPresence(): Promise<void> {
  return apiFetch<void>("/mentors/me/presence", { method: "POST" });
}

export interface MentorPresenceStatus {
  is_online: boolean;
  chat_busy: boolean;
  status: "online" | "offline" | "busy";
}

export function getMentorPresenceStatus(): Promise<MentorPresenceStatus> {
  return apiFetch<MentorPresenceStatus>("/mentors/me/presence-status");
}

export function patchMentorMe(body: MentorPatchBody): Promise<MentorAccount> {
  return apiFetch<MentorAccount>("/mentors/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function acceptCoachAgreement(body: {
  signature_name: string;
  agreement_version: string;
  agreement_text_snapshot: string;
}): Promise<MentorAccount> {
  return apiFetch<MentorAccount>("/mentors/me/coach-agreement", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listMySlots(): Promise<AvailabilitySlot[]> {
  return apiFetch<AvailabilitySlot[]>("/mentors/me/slots");
}

export function createMySlot(body: SlotCreateBody): Promise<AvailabilitySlot> {
  return apiFetch<AvailabilitySlot>("/mentors/me/slots", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchMySlot(slotId: string, body: SlotPatchBody): Promise<AvailabilitySlot> {
  return apiFetch<AvailabilitySlot>(`/mentors/me/slots/${slotId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteMySlot(slotId: string): Promise<void> {
  return apiFetch<void>(`/mentors/me/slots/${slotId}`, { method: "DELETE" });
}

export interface EarningsSummary {
  total_amount: string;
  payment_count: number;
  currency: string;
}

export function getMentorEarnings(): Promise<EarningsSummary> {
  return apiFetch<EarningsSummary>("/mentors/me/earnings");
}

export type AnalyticsPeriod = "day" | "week" | "month" | "year";

export interface DateAmountPoint {
  date: string;
  amount: string;
}

export interface MentorEarningsSeries {
  period: AnalyticsPeriod;
  range_start: string;
  range_end: string;
  bookings_by_day: DateAmountPoint[];
  chat_by_day: DateAmountPoint[];
}

export function getMentorEarningsSeries(period: AnalyticsPeriod): Promise<MentorEarningsSeries> {
  return apiFetch<MentorEarningsSeries>(`/mentors/me/earnings-series?period=${period}`);
}

export function getCoachWalletBalances(currency = "EUR"): Promise<CoachWalletBalances> {
  return apiFetch<CoachWalletBalances>(`/marketplace/wallet/me?currency=${encodeURIComponent(currency)}`);
}

export interface CreateCoachPayoutRequestIn {
  amount: number;
  currency?: string;
  idempotency_key?: string;
}

export function createCoachPayoutRequest(payload: CreateCoachPayoutRequestIn): Promise<CoachPayoutRequestRow> {
  return apiFetch<CoachPayoutRequestRow>("/marketplace/payouts/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listCoachPayoutRequests(): Promise<CoachPayoutRequestRow[]> {
  return apiFetch<CoachPayoutRequestRow[]>("/marketplace/payouts");
}

export interface CoachConnectStartOut {
  onboarding_state: string;
  onboarding_url: string;
}

export function startCoachConnectOnboarding(): Promise<CoachConnectStartOut> {
  return apiFetch<CoachConnectStartOut>("/marketplace/connect/start", { method: "POST" });
}

export function getCoachConnectStatus(): Promise<CoachConnectStatus> {
  return apiFetch<CoachConnectStatus>("/marketplace/connect/status");
}

export function refreshCoachConnectStatus(): Promise<CoachConnectStatus> {
  return apiFetch<CoachConnectStatus>("/marketplace/connect/refresh", { method: "POST" });
}

export interface MentorPayoutBankDetails {
  has_bank_details: boolean;
  account_holder_name: string | null;
  iban_masked: string | null;
  bic_masked: string | null;
  status: string;
  verified_at: string | null;
  updated_at: string | null;
}

export function getMentorPayoutBankDetails(): Promise<MentorPayoutBankDetails> {
  return apiFetch<MentorPayoutBankDetails>("/mentors/me/payout-bank-details");
}

export function saveMentorPayoutBankDetails(body: {
  account_holder_name: string;
  iban: string;
  bic?: string | null;
}): Promise<MentorPayoutBankDetails> {
  return apiFetch<MentorPayoutBankDetails>("/mentors/me/payout-bank-details", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export interface MentorMonthlyInvoice {
  id: string;
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

export function listMentorMonthlyInvoices(): Promise<MentorMonthlyInvoice[]> {
  return apiFetch<MentorMonthlyInvoice[]>("/mentors/me/monthly-invoices");
}

export interface MentorOnboardingPayment {
  id: string;
  amount: string;
  currency: string;
  status: string;
  mollie_payment_id: string;
  checkout_url: string | null;
  payment_plan: string;
  installment_number: number;
  installment_total: number;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MentorOnboardingStatus {
  is_complete: boolean;
  payment_plan: string | null;
  installments_paid: number;
  installment_total: number;
  next_installment_number: number | null;
  next_amount_eur: string | null;
}

export function getMentorOnboardingStatus(): Promise<MentorOnboardingStatus> {
  return apiFetch<MentorOnboardingStatus>("/mentors/me/onboarding-status");
}

export function createMentorOnboardingPaymentMe(body: {
  checkout_currency?: string;
  payment_plan: "full" | "installments";
  installment_number?: number;
  promo_code?: string | null;
}): Promise<{
  payment_id: string;
  checkout_url: string;
  amount: string;
  currency: string;
  payment_plan: string;
  installment_number: number;
  installment_total: number;
}> {
  return apiFetch("/mentors/me/onboarding-payment", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listMentorOnboardingPayments(): Promise<MentorOnboardingPayment[]> {
  return apiFetch<MentorOnboardingPayment[]>("/mentors/me/onboarding-payments");
}

export interface MentorMonthlyFeeStatement {
  kind: string;
  invoice_number: string;
  invoice_id: string;
  issued_at: string;
  platform_legal_name: string;
  platform_contact_email: string;
  coach_name: string;
  coach_email: string;
  invoice_month: string;
  gross_revenue: string;
  fee_percent: string;
  fee_amount: string;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  checkout_amount: string | null;
  checkout_currency: string | null;
  fee_fx_rate: string | null;
  mollie_payment_id: string | null;
}

export function fetchMentorMonthlyFeeStatement(invoiceId: string): Promise<MentorMonthlyFeeStatement> {
  return apiFetch<MentorMonthlyFeeStatement>(`/mentors/me/monthly-invoices/${invoiceId}`);
}

export function downloadMentorMonthlyInvoicePdf(invoiceId: string) {
  return apiFetchBlob(`/mentors/me/monthly-invoices/${invoiceId}/pdf`);
}

export interface MentorOnboardingInvoice {
  kind: string;
  invoice_number: string;
  payment_id: string;
  issued_at: string;
  platform_legal_name: string;
  platform_contact_email: string;
  coach_name: string;
  coach_email: string;
  line_description: string;
  amount: string;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  mollie_payment_id: string;
}

export function fetchMentorOnboardingInvoice(paymentId: string): Promise<MentorOnboardingInvoice> {
  return apiFetch<MentorOnboardingInvoice>(`/mentors/me/onboarding-payments/${paymentId}/invoice`);
}

export function prepareMentorMonthlyInvoiceCheckout(
  invoiceId: string,
  checkoutCurrency: string,
): Promise<MentorMonthlyInvoice> {
  return apiFetch<MentorMonthlyInvoice>(`/mentors/me/monthly-invoices/${invoiceId}/prepare-checkout`, {
    method: "POST",
    body: JSON.stringify({ checkout_currency: checkoutCurrency }),
  });
}

export function joinWaitlist(mentorId: string): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(`/mentors/${mentorId}/waitlist`, { method: "POST" });
}

export function leaveWaitlist(mentorId: string): Promise<{ status: string; message: string }> {
  return apiFetch<{ status: string; message: string }>(`/mentors/${mentorId}/waitlist`, { method: "DELETE" });
}

export function getWaitlistPosition(mentorId: string): Promise<{ position: number | null }> {
  return apiFetch<{ position: number | null }>(`/mentors/${mentorId}/waitlist/position`);
}
