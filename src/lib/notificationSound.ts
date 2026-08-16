/** Platform notification sound: bundled clip, with a short generated ping as fallback. */

import notificationSrc from "@/assets/audio/notification.mp4?url";

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let audioCtx: AudioContext | null = null;
let gestureBound = false;
let lastPlayedAt = 0;
const COOLDOWN_MS = 1200;

let customAudio: HTMLAudioElement | null = null;

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
  lastPlayedAt = Date.now();
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
    if (ctx.state === "running" && Date.now() - lastPlayedAt >= COOLDOWN_MS) {
      emitGeneratedChime(ctx);
    }
  });
}

function getCustomAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (customAudio) return customAudio;
  customAudio = new Audio(notificationSrc);
  customAudio.preload = "auto";
  customAudio.volume = 0.7;
  return customAudio;
}

async function playCustomFile(): Promise<boolean> {
  const el = getCustomAudio();
  if (!el) return false;
  try {
    el.pause();
    el.currentTime = 0;
    await el.play();
    lastPlayedAt = Date.now();
    return true;
  } catch {
    return false;
  }
}

export function unlockNotificationAudio() {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    void ctx.resume();
  }
  const el = getCustomAudio();
  if (!el) return;
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

export function bindNotificationAudioUnlock() {
  if (typeof window === "undefined" || gestureBound) return;
  gestureBound = true;
  const unlock = () => unlockNotificationAudio();
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

/** Plays the bundled notification clip. Coalesces bursts so poll + websocket do not stack. */
export function playNotificationChime() {
  const now = Date.now();
  if (now - lastPlayedAt < COOLDOWN_MS) return;

  void playCustomFile().then((played) => {
    if (!played) playGeneratedFallback();
  });
}
