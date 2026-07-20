const PATTERNS: Array<[RegExp, string]> = [
  [/unauthorized|invalid email or password/i, "Incorrect email or password. Please try again."],
  [/forbidden|not allowed/i, "You don't have permission to do that."],
  [/not found/i, "We couldn't find what you're looking for."],
  [/network|failed to fetch|load failed/i, "Connection problem. Check your internet and try again."],
  [/mollie create payment failed/i, "Payment could not be started. Please try again in a moment."],
  [/offline/i, "This coach is offline. Book when they are online on the platform."],
  [/mentor is currently in a chat|mentor_in_chat/i, "This coach is in another session. Try again shortly."],
  [/an account with this email already exists/i, "This email is already registered. Sign in with your password first."],
  [/this coach account uses a password/i, "Sign in with your password first to link Google to your coach account."],
  [/invalid or expired/i, "That code has expired or is incorrect. Request a new one and try again."],
];

export function humanizeApiError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }
  for (const [pattern, message] of PATTERNS) {
    if (pattern.test(trimmed)) {
      return message;
    }
  }
  if (trimmed.length > 140 || /traceback|sqlalchemy|httpx|HTTPException/i.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}
