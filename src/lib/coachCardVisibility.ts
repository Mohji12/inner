/** Keys coaches can toggle for public browse cards. */
export type CoachCardVisibilityKey =
  | "headline"
  | "expertise_tags"
  | "years_experience"
  | "rating"
  | "session_packages"
  | "profile_photo"
  | "banner_photo";

export type CoachCardVisibility = Record<CoachCardVisibilityKey, boolean>;

export const DEFAULT_COACH_CARD_VISIBILITY: CoachCardVisibility = {
  headline: true,
  expertise_tags: true,
  years_experience: true,
  rating: true,
  session_packages: true,
  profile_photo: true,
  banner_photo: true,
};

export const COACH_CARD_VISIBILITY_KEYS = Object.keys(
  DEFAULT_COACH_CARD_VISIBILITY,
) as CoachCardVisibilityKey[];

export function normalizeCoachCardVisibility(
  raw?: Partial<CoachCardVisibility> | null,
): CoachCardVisibility {
  const out = { ...DEFAULT_COACH_CARD_VISIBILITY };
  if (!raw) return out;
  for (const key of COACH_CARD_VISIBILITY_KEYS) {
    if (key in raw && typeof raw[key] === "boolean") {
      out[key] = raw[key] as boolean;
    }
  }
  return out;
}

export function isCardFieldVisible(
  visibility: Partial<CoachCardVisibility> | null | undefined,
  key: CoachCardVisibilityKey,
): boolean {
  const vis = normalizeCoachCardVisibility(visibility);
  return vis[key];
}
