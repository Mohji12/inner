/** Platform notification sounds: bundled clips, with a short generated ping as fallback. */

import bookingAlertSrc from "@/assets/audio/booking-alert.mp4?url";
import notificationSrc from "@/assets/audio/WhatsApp Audio 2026-08-17 at 04.34.36.mp4?url";

export type NotificationSoundKind = "default" | "booking";

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const BOOKING_NOTIFICATION_TYPES = new Set([
  "booking",
  "booking_started",
  "booking_confirmed",
]);

const SOURCES: Record<NotificationSoundKind, string> = {
  default: notificationSrc,
  booking: bookingAlertSrc,
};

const COOLDOWN_MS: Record<NotificationSoundKind, number> = {
  default: 1200,
  booking: 4000,
};

let audioCtx: AudioContext | null = null;
/** True after a user gesture successfully unlocked Web Audio / HTMLAudio. */
let audioUnlocked = false;
const lastPlayedAt: Record<NotificationSoundKind, number> = {
  default: 0,
  booking: 0,
};
const players = new Map<NotificationSoundKind, HTMLAudioElement>();

export function isBookingNotificationType(type: string | undefined | null): boolean {
  return Boolean(type && BOOKING_NOTIFICATION_TYPES.has(type));
}

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!AC) return null;
  try {
    return new AC();
  } catch {
    return null;
  }
}

function getAudioContext(options?: { create?: boolean }): AudioContext | null {
  if (audioCtx) return audioCtx;
  if (!options?.create) return null;
  audioCtx = createAudioContext();
  return audioCtx;
}

function playTone(ctx: AudioContext, frequency: number, startAt: number, duration: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

function emitGeneratedChime(ctx: AudioContext) {
  lastPlayedAt.default = Date.now();
  const t0 = ctx.currentTime;
  playTone(ctx, 880, t0, 0.14);
  playTone(ctx, 1175, t0 + 0.11, 0.18);
}

/** Generated chime only when Web Audio is already unlocked and running. */
function playGeneratedFallback() {
  if (!audioUnlocked) return;
  const ctx = getAudioContext({ create: false });
  if (!ctx || ctx.state !== "running") return;
  emitGeneratedChime(ctx);
}

function getCustomAudio(kind: NotificationSoundKind): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const existing = players.get(kind);
  if (existing) return existing;
  const el = new Audio(SOURCES[kind]);
  el.preload = "auto";
  el.volume = kind === "booking" ? 0.85 : 0.7;
  players.set(kind, el);
  return el;
}

async function playCustomFile(kind: NotificationSoundKind): Promise<boolean> {
  const el = getCustomAudio(kind);
  if (!el) return false;
  try {
    el.pause();
    el.currentTime = 0;
    await el.play();
    lastPlayedAt[kind] = Date.now();
    audioUnlocked = true;
    return true;
  } catch {
    return false;
  }
}

function unlockElement(el: HTMLAudioElement) {
  const previous = el.volume;
  el.muted = true;
  el.volume = 0;
  void el
    .play()
    .then(() => {
      el.pause();
      el.currentTime = 0;
      audioUnlocked = true;
    })
    .catch(() => {
      // Still blocked — wait for a later gesture.
    })
    .finally(() => {
      el.muted = false;
      el.volume = previous || 0.7;
    });
}

export function unlockNotificationAudio(options?: { includeBooking?: boolean }) {
  // Create / resume Web Audio only inside this gesture-driven path.
  const ctx = getAudioContext({ create: true });
  if (ctx) {
    if (ctx.state === "running") {
      audioUnlocked = true;
    } else if (ctx.state === "suspended") {
      void ctx
        .resume()
        .then(() => {
          if (ctx.state === "running") audioUnlocked = true;
        })
        .catch(() => {
          // Ignore — browser may still block until a stronger gesture.
        });
    }
  }

  for (const kind of Object.keys(SOURCES) as NotificationSoundKind[]) {
    if (kind === "booking" && !options?.includeBooking) continue;
    const el = getCustomAudio(kind);
    if (el) unlockElement(el);
  }
}

let coachBookingGestureBound = false;
let defaultNotificationGestureBound = false;

function bindUnlockOnce(
  flag: "default" | "coach",
  handler: () => void,
) {
  if (typeof window === "undefined") return;
  if (flag === "default" && defaultNotificationGestureBound) return;
  if (flag === "coach" && coachBookingGestureBound) return;

  if (flag === "default") defaultNotificationGestureBound = true;
  else coachBookingGestureBound = true;

  const onGesture = () => {
    handler();
    window.removeEventListener("pointerdown", onGesture);
    window.removeEventListener("keydown", onGesture);
  };
  window.addEventListener("pointerdown", onGesture, { passive: true });
  window.addEventListener("keydown", onGesture, { passive: true });
}

/** Unlocks chat/notification audio after the first gesture (default sound only). */
export function bindDefaultNotificationAudioUnlock() {
  bindUnlockOnce("default", () => unlockNotificationAudio({ includeBooking: false }));
}

/** Unlocks booking alert audio after gesture — coach dashboard only. */
export function bindCoachBookingAudioUnlock() {
  bindUnlockOnce("coach", () => unlockNotificationAudio({ includeBooking: true }));
}

/** Plays a bundled clip. Coalesces bursts so poll + websocket do not stack. */
export function playNotificationChime(kind: NotificationSoundKind = "default") {
  const now = Date.now();
  if (now - lastPlayedAt[kind] < COOLDOWN_MS[kind]) return;

  void playCustomFile(kind).then((played) => {
    if (played) return;
    // HTMLAudio blocked by autoplay — only fall back after a user unlock.
    if (!audioUnlocked) return;
    if (kind === "default") {
      playGeneratedFallback();
      return;
    }
    void playCustomFile("default").then((fallbackPlayed) => {
      if (!fallbackPlayed) playGeneratedFallback();
    });
  });
}
