export const COACH_AGREEMENT_VERSION = "2026-05-25";

export const COACH_AGREEMENT_STORAGE_KEY = "ipd_coach_agreement_acceptance";

export type StoredCoachAgreementAcceptance = {
  signatureName: string;
  version: string;
  acceptedAt: string;
};

export function saveCoachAgreementAcceptance(signatureName: string): StoredCoachAgreementAcceptance {
  const payload: StoredCoachAgreementAcceptance = {
    signatureName: signatureName.trim(),
    version: COACH_AGREEMENT_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(COACH_AGREEMENT_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function readCoachAgreementAcceptance(): StoredCoachAgreementAcceptance | null {
  try {
    const raw = sessionStorage.getItem(COACH_AGREEMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCoachAgreementAcceptance;
    if (parsed.version !== COACH_AGREEMENT_VERSION || !parsed.signatureName?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const COACH_AGREEMENT_TEXT = `Coach Agreement

By registering as a coach on this platform, you agree to the following payment terms:

1) Metered chat: you receive 70% of the gross per-minute rate (billed per minute/second), including your own tax obligations; the platform retains 30% as platform charges.
2) Users also pay a fixed €0.50 transaction fee per chat session to the platform (not split with coaches).

You acknowledge and accept these terms at the time of registration.
`;

export const COACH_MEDICAL_GUIDELINES = [
  "Coaches must not act as medical doctors or healthcare professionals unless officially licensed.",
  "Coaches are not permitted to provide medical advice, diagnosis, prescriptions, or treatment recommendations.",
  "Coaches must avoid making any clinical or health-related claims to users.",
  "All guidance provided should be limited to mentoring, motivation, wellness support, and personal development.",
  "Users with medical concerns, symptoms, or emergencies must be referred to a qualified healthcare professional immediately.",
  "Coaches must not suggest stopping, starting, or changing any medication or medical treatment.",
  "Any health-related discussion should be clearly communicated as non-medical and informational only.",
  "Violation of these guidelines may result in suspension or removal from the platform.",
] as const;

