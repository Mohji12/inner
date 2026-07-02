import { apiFetch } from "./client";
import type { 
  AccessTokenResponse, 
  LoginResponse,
  MentorRegisterResult, 
  SocialLoginRequest,
  TwoFactorLoginRequest,
  TwoFactorSetupResponse,
  TwoFactorVerifyRequest,
  UserRegisterResult 
} from "./types";

export interface UserRegisterBody {
  full_name: string;
  email: string;
  phone_number: string;
  password: string;
  preferred_language?: string;
}

export interface UserLoginBody {
  email: string;
  password: string;
}

export interface MentorRegisterBody {
  full_name: string;
  email: string;
  phone_number: string;
  password: string;
  headline?: string | null;
  bio?: string | null;
  profile_image?: string | null;
  current_company?: string | null;
  kvk_number?: string | null;
  languages_spoken?: string[] | null;
  years_of_experience?: number | null;
  expertise_areas?: string[] | null;
  skills?: string[] | null;
  education?: string[] | null;
  certifications?: string[] | null;
  tools_technologies?: string[] | null;
  session_modes?: string[] | null;
  public_card_visibility?: Record<string, boolean> | null;
  agreement_accepted: boolean;
  agreement_version: string;
  agreement_text_snapshot: string;
}

export interface MentorLoginBody {
  email: string;
  password: string;
}

export interface VerifyEmailBody {
  email: string;
  code: string;
}

export function registerUser(body: UserRegisterBody): Promise<UserRegisterResult> {
  return apiFetch<UserRegisterResult>("/auth/user/register", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function loginUser(body: UserLoginBody): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/user/login", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function loginUser2FA(body: TwoFactorLoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/user/2fa/login", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function loginUserGoogle(body: SocialLoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/user/google", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function setupUser2FA(): Promise<TwoFactorSetupResponse> {
  return apiFetch<TwoFactorSetupResponse>("/auth/user/2fa/setup", {
    method: "POST",
  });
}

export function verifyUser2FASetup(body: TwoFactorVerifyRequest): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/user/2fa/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function logoutUser(): Promise<void> {
  return apiFetch<void>("/auth/user/logout", { method: "POST" });
}

export function registerMentor(body: MentorRegisterBody): Promise<MentorRegisterResult> {
  return apiFetch<MentorRegisterResult>("/auth/mentor/register", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function verifyUserEmail(body: VerifyEmailBody): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/user/verify-email", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function verifyMentorEmail(body: VerifyEmailBody): Promise<{ message: string; account_active?: boolean }> {
  return apiFetch<{ message: string; account_active?: boolean }>("/auth/mentor/verify-email", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function resendUserVerifyEmail(email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/user/resend-verify-email", {
    method: "POST",
    body: JSON.stringify({ email }),
    skipAuth: true,
  });
}

export function resendMentorVerifyEmail(email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/mentor/resend-verify-email", {
    method: "POST",
    body: JSON.stringify({ email }),
    skipAuth: true,
  });
}

export function validateMentorOnboardingPromo(
  code: string,
  paymentPlan: "full" | "installments" = "full",
  installmentNumber = 1,
): Promise<{
  is_valid: boolean;
  discount_amount_eur: string;
  final_amount_eur: string;
  message?: string | null;
}> {
  return apiFetch("/auth/mentor/onboarding-promo/validate", {
    method: "POST",
    body: JSON.stringify({
      code,
      payment_plan: paymentPlan,
      installment_number: installmentNumber,
    }),
    skipAuth: true,
  });
}

export function createMentorOnboardingPayment(
  email: string,
  checkoutCurrency?: string,
  paymentPlan: "full" | "installments" = "full",
  installmentNumber = 1,
  promoCode?: string,
): Promise<{
  payment_id: string;
  checkout_url: string;
  amount: string;
  currency: string;
  payment_plan: string;
  installment_number: number;
  installment_total: number;
}> {
  return apiFetch("/auth/mentor/onboarding-payment", {
    method: "POST",
    body: JSON.stringify({
      email,
      checkout_currency: checkoutCurrency ?? null,
      payment_plan: paymentPlan,
      installment_number: installmentNumber,
      promo_code: promoCode?.trim() || null,
    }),
    skipAuth: true,
  });
}

export function getMentorOnboardingPlans(): Promise<{
  total_eur: string;
  full_eur: string;
  installment_eur: string;
  installment_count: number;
  is_free: boolean;
}> {
  return apiFetch("/auth/mentor/onboarding-plans", { skipAuth: true });
}

export function loginMentor(body: MentorLoginBody): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/mentor/login", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function loginMentor2FA(body: TwoFactorLoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/mentor/2fa/login", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function loginMentorGoogle(body: SocialLoginRequest): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/mentor/google", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function setupMentor2FA(): Promise<TwoFactorSetupResponse> {
  return apiFetch<TwoFactorSetupResponse>("/auth/mentor/2fa/setup", {
    method: "POST",
  });
}

export function verifyMentor2FASetup(body: TwoFactorVerifyRequest): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/mentor/2fa/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function logoutMentor(): Promise<void> {
  return apiFetch<void>("/auth/mentor/logout", { method: "POST" });
}

export function loginAdmin(body: UserLoginBody): Promise<AccessTokenResponse> {
  return apiFetch<AccessTokenResponse>("/auth/admin/login", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function logoutAdmin(): Promise<void> {
  return apiFetch<void>("/auth/admin/logout", { method: "POST" });
}

export interface ForgotPasswordBody {
  email: string;
  role: "user" | "mentor";
}

export interface ResetPasswordBody {
  email: string;
  role: "user" | "mentor";
  code: string;
  new_password: string;
}

export function forgotPassword(body: ForgotPasswordBody): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function resetPassword(body: ResetPasswordBody): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}
