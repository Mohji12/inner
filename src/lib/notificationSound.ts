/** Platform notification sounds: bundled clips, with a short generated ping as fallback. */

import bookingAlertSrc from "@/assets/audio/booking-alert.mp4?url";
import notificationSrc from "@/assets/audio/notification.mp4?url";

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
let gestureBound = false;
const lastPlayedAt: Record<NotificationSoundKind, number> = {
  default: 0,
  booking: 0,
};
const players = new Map<NotificationSoundKind, HTMLAudioElement>();

export function isBookingNotificationType(type: string | undefined | null): boolean {
  return Boolean(type && BOOKING_NOTIFICATION_TYPES.has(type));
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const AC = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!AC) return null;
  audioCtx = new AC();
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

function playGeneratedFallback() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "running") {
    emitGeneratedChime(ctx);
    return;
  }
  void ctx.resume().then(() => {
    if (ctx.state === "running" && Date.now() - lastPlayedAt.default >= COOLDOWN_MS.default) {
      emitGeneratedChime(ctx);
    }
  });
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
    })
    .catch(() => {
      // Autoplay still blocked until a later gesture.
    })
    .finally(() => {
      el.muted = false;
      el.volume = previous || 0.7;
    });
}

export function unlockNotificationAudio() {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    void ctx.resume();
  }
  for (const kind of Object.keys(SOURCES) as NotificationSoundKind[]) {
    const el = getCustomAudio(kind);
    if (el) unlockElement(el);
  }
}

export function bindNotificationAudioUnlock() {
  if (typeof window === "undefined" || gestureBound) return;
  gestureBound = true;
  const unlock = () => unlockNotificationAudio();
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

/** Plays a bundled clip. Coalesces bursts so poll + websocket do not stack. */
export function playNotificationChime(kind: NotificationSoundKind = "default") {
  const now = Date.now();
  if (now - lastPlayedAt[kind] < COOLDOWN_MS[kind]) return;

  void playCustomFile(kind).then((played) => {
    if (!played && kind === "default") playGeneratedFallback();
    if (!played && kind !== "default") {
      void playCustomFile("default").then((fallbackPlayed) => {
        if (!fallbackPlayed) playGeneratedFallback();
      });
    }
  });
}
