/** API shapes (snake_case as returned by FastAPI). */

export interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginResponse extends AccessTokenResponse {
  two_factor_required: boolean;
  temp_token?: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  provisioning_uri: string;
  qr_code_base64: string;
}

export interface TwoFactorVerifyRequest {
  code: string;
}

export interface TwoFactorLoginRequest {
  email: string;
  code: string;
  temp_token: string;
  role: 'user' | 'mentor';
}

export interface SocialLoginRequest {
  id_token: string;
}

export interface UserOut {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  profile_image: string | null;
  gender: string | null;
  date_of_birth: string | null;
  location: string | null;
  country_code: string | null;
  timezone: string;
  preferred_language: string;
  interests: unknown[] | null;
  goals: string | null;
  preferred_categories: unknown[] | null;
  preferred_communication_mode: string | null;
  last_login: string | null;
  account_status: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

/** POST /auth/user/register — includes dev OTP when SMTP is not configured */
export interface UserRegisterResult extends UserOut {
  dev_verification_code?: string | null;
}

export interface MentorPublic {
  id: string;
  full_name: string;
  country_code?: string | null;
  timezone?: string;
  headline: string | null;
  current_company?: string | null;
  profile_image: string | null;
  banner_image?: string | null;
  /** DB JSON — usually string labels */
  languages_spoken: unknown[] | null;
  years_of_experience: number;
  expertise_areas: unknown[] | null;
  skills: unknown[] | null;
  average_rating: string;
  total_reviews: number;
  total_sessions_completed: number;
  is_verified: boolean;
  chat_price_per_minute: string;
  chat_currency: string;
  chat_min_purchase_minutes: number;
  chat_available: boolean;
  is_online: boolean;
  last_seen_at: string | null;
  status: string;
  created_at: string;
  badges?: string[];
  /** From API — global pricing on + mentor approved/active */
  session_packages_available?: boolean;
}

export type MentorAvailabilityStatus = "available" | "busy" | "offline";

export function getMentorAvailabilityStatus(
  mentor: Pick<MentorPublic, "is_online" | "chat_available" | "chat_price_per_minute">,
): MentorAvailabilityStatus {
  if (!mentor.is_online) return "offline";
  const chatEnabled = Number(mentor.chat_price_per_minute) > 0;
  if (!chatEnabled) return "available";
  return mentor.chat_available ? "available" : "busy";
}

export interface MentorDetail extends MentorPublic {
  bio: string | null;
  current_company: string | null;
  previous_companies: unknown[] | null;
  education: unknown[] | null;
  certifications: unknown[] | null;
  tools_technologies: unknown[] | null;
  session_modes: unknown[] | null;
}

export interface MentorAccount extends MentorDetail {
  email: string;
  phone_number: string;
  is_approved: boolean;
  is_verified: boolean;
  email_verified: boolean;
  updated_at: string;
}

/** POST /auth/mentor/register — includes dev OTP when SMTP is not configured */
export interface MentorRegisterResult extends MentorAccount {
  dev_verification_code?: string | null;
}

export interface PlatformPricing {
  price_5_min: string;
  price_10_min: string;
  price_20_min: string;
  price_30_min: string;
  currency: string;
  is_active: boolean;
}

export interface AvailabilitySlot {
  id: string;
  mentor_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  start_at_utc: string;
  end_at_utc: string;
  slot_duration: number;
  is_booked: boolean;
  is_recurring: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  mentor_id: string;
  slot_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  start_at_utc: string;
  end_at_utc: string;
  duration: number;
  session_topic: string | null;
  problem_description: string | null;
  goals_expected: string | null;
  experience_level: string | null;
  communication_mode: string | null;
  urgency_level: string | null;
  preferred_language: string | null;
  attachments: unknown[] | null;
  status: string;
  payment_status: string;
  payment_id: string | null;
  meeting_link: string | null;
  notes_by_user: string | null;
  notes_by_mentor: string | null;
  created_at: string;
}

export interface PaymentOut {
  id: string;
  user_id: string;
  booking_id: string;
  amount: string;
  currency: string;
  payment_gateway: string;
  transaction_id: string | null;
  status: string;
  created_at: string;
}

export interface ReviewOut {
  id: string;
  user_id: string;
  mentor_id: string;
  booking_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
}

export function slotPriceForDuration(pricing: PlatformPricing, minutes: number): number {
  const p5 = Number(pricing.price_5_min);
  const p10 = Number(pricing.price_10_min);
  const p20 = Number(pricing.price_20_min);
  const p30 = Number(pricing.price_30_min);
  if (minutes <= 5) return p5;
  if (minutes <= 10) return p10;
  if (minutes <= 20) return p20;
  return p30;
}

/** Session package EUR: coach minute rate × length when chat pricing is on; else platform tier. */
export function sessionPackageEur(
  mentor: Pick<MentorDetail, "chat_price_per_minute">,
  pricing: PlatformPricing | undefined,
  minutes: number,
): number {
  const perMin = Number(mentor.chat_price_per_minute);
  if (Number.isFinite(perMin) && perMin > 0) {
    return Math.round(perMin * minutes * 100) / 100;
  }
  if (!pricing) return 0;
  return slotPriceForDuration(pricing, minutes);
}

export function formatTimeLabel(isoTime: string): string {
  const part = isoTime.slice(0, 5);
  return part;
}

export interface ChatSession {
  id: string;
  user_id: string;
  mentor_id: string;
  status: string;
  ends_at: string;
  remaining_seconds: number;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  unread_count_user: number;
  unread_count_mentor: number;
}

export interface ChatSessionCheckout {
  session: ChatSession;
  checkout_url: string;
  mollie_payment_id: string;
}

export interface ChatSessionExtendQuote {
  minutes: number;
  rate_per_minute_eur: string;
  session_amount_eur: string;
  transaction_fee_eur: string;
  total_eur: string;
  checkout_amount: string;
  checkout_currency: string;
  fx_rate_used: string | null;
  min_minutes: number;
}

/** POST /chat/sessions/{id}/call/token — LiveKit WebRTC room */
export interface ChatCallToken {
  provider: string;
  url: string;
  token: string;
  room_name: string;
  expires_in_seconds: number;
}

/** POST /chat/sessions/{id}/call/dial — LiveKit SIP outbound to peer's profile phone */
export interface ChatDialOut {
  participant_id: string;
  participant_identity: string;
  room_name: string;
  sip_call_id: string;
  dialed_phone_e164: string;
}

export interface ChatPhoneBridgeIn {
  number_a: string;
  number_b: string;
  label_a?: string | null;
  label_b?: string | null;
}

export interface ChatPhoneBridgeLeg {
  participant_id: string | null;
  participant_identity: string | null;
  sip_call_id: string | null;
  dialed_phone_e164: string;
  status: string;
  error: string | null;
}

export interface ChatPhoneBridgeOut {
  bridge_session_id: string;
  room_name: string;
  status: string;
  actor_role: string;
  leg_a: ChatPhoneBridgeLeg;
  leg_b: ChatPhoneBridgeLeg;
  error_hint: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_role: "user" | "mentor" | string;
  sender_display_name?: string;
  body: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_filename?: string | null;
  attachment_size_bytes?: number | null;
  read_at: string | null;
  created_at: string;
}

export interface ChatInboxSession extends ChatSession {
  partner_name: string;
  partner_profile_image: string | null;
  last_message_body: string | null;
  last_message_role: string | null;
}

export interface ChatInbox {
  sessions: ChatInboxSession[];
}

export interface ChatInvoiceSummary {
  session_id: string;
  invoice_number: string;
  mentor_name: string;
  customer_display_name?: string | null;
  total_amount: string;
  currency: string;
  total_minutes_purchased: number;
  payment_status: string;
  session_started_at: string;
  session_ended_at: string;
  issued_at: string;
}

export interface ChatInvoiceLine {
  id: string;
  minutes: number;
  amount: string;
  currency: string;
  status: string;
  transaction_id: string | null;
  created_at: string;
}

export interface ChatInvoiceConversationLine {
  id: string;
  sender_role: string;
  sender_display_name: string;
  body: string;
  created_at: string;
}

export interface ChatInvoiceDetail {
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
  line_items: ChatInvoiceLine[];
  conversation: ChatInvoiceConversationLine[];
}

export interface CoachWalletBalances {
  currency: string;
  available_balance: string;
  pending_balance: string | null;
  withdrawable_balance: string | null;
}

export interface CoachPayoutRequestRow {
  id: string;
  mentor_id: string;
  amount: string;
  currency: string;
  status: string;
  requested_at: string;
  processed_at: string | null;
  failure_reason: string | null;
}

export interface CoachConnectStatus {
  mentor_id?: string;
  onboarding_state: string;
  kyc_status: string;
  payouts_enabled: boolean;
  provider_account_id?: string | null;
  provider_account_label?: string | null;
  provider_account_masked?: string | null;
  capabilities_status?: string | null;
  /** Mollie hosted onboarding (bank + verification); from GET /v2/onboarding/me */
  mollie_onboarding_dashboard_url?: string | null;
  /** From POST /marketplace/connect/refresh — Mollie balances.read */
  mollie_settlement_available?: string | null;
  mollie_balance_note?: string | null;
}

export interface AdminCommissionConfig {
  id: string;
  percent: string;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
}

export interface AdminCapabilityMatrixRow {
  id: string;
  country_code: string;
  entity_type: string;
  currency: string;
  supports_connect: boolean;
  supports_payouts: boolean;
  supports_transfers: boolean;
  notes: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface AdminPayoutApprovalRow {
  id: string;
  mentor_id: string;
  amount: string;
  currency: string;
  status: string;
  requested_at: string;
  processed_at: string | null;
  failure_reason: string | null;
}
