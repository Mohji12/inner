import { useCallback, useEffect, useRef, useState } from "react";
import { Music, Pause } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { safeSessionStorage } from "@/lib/safeStorage";
import musicSrc from "@/assets/audio/morning-currencies.mp3?url";

const MUSIC_SRC = (import.meta.env.VITE_HOME_MUSIC_URL as string | undefined)?.trim() || musicSrc;
const ENTERED_KEY = "ipd_site_entered";

/**
 * Soft background music for the homepage.
 * Never blocks the UI — Mac Safari often blocks unmuted autoplay; we start muted
 * (or wait for a gesture) and unmute on the first click/tap/key without a full-screen gate.
 */
const HomeBackgroundMusic = () => {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);
  const userStoppedRef = useRef(false);
  const unmutePendingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const unmuteAndPlay = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio || userStoppedRef.current) return false;

    audio.muted = false;
    audio.volume = 0.4;

    try {
      if (audio.paused) {
        await audio.play();
      }
      unmutePendingRef.current = false;
      safeSessionStorage.setItem(ENTERED_KEY, "1");
      return true;
    } catch {
      return false;
    }
  }, []);

  const startPlayback = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio || userStoppedRef.current) return false;

    audio.volume = 0.4;

    try {
      audio.muted = false;
      await audio.play();
      unmutePendingRef.current = false;
      safeSessionStorage.setItem(ENTERED_KEY, "1");
      return true;
    } catch {
      try {
        // Safari desktop often allows muted autoplay only.
        audio.muted = true;
        await audio.play();
        unmutePendingRef.current = true;
        return true;
      } catch {
        audio.muted = false;
        unmutePendingRef.current = true;
        return false;
      }
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.loop = true;
    audio.volume = 0.4;
    userStoppedRef.current = false;

    const onError = () => setLoadError(true);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener("error", onError);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    let cancelled = false;

    const onUserGesture = () => {
      if (cancelled || userStoppedRef.current) return;
      if (unmutePendingRef.current || audio.paused) {
        void unmuteAndPlay();
      }
    };

    const gestureEvents: (keyof DocumentEventMap)[] = ["pointerdown", "keydown", "touchstart", "click"];
    for (const eventName of gestureEvents) {
      document.addEventListener(eventName, onUserGesture, { capture: true });
    }

    const tryAutoplay = async () => {
      if (cancelled || userStoppedRef.current) return;
      await startPlayback();
    };

    const onReady = () => {
      void tryAutoplay();
    };

    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      void tryAutoplay();
    } else {
      audio.addEventListener("canplaythrough", onReady, { once: true });
      audio.addEventListener("loadeddata", onReady, { once: true });
    }

    return () => {
      cancelled = true;
      audio.removeEventListener("error", onError);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("canplaythrough", onReady);
      audio.removeEventListener("loadeddata", onReady);
      for (const eventName of gestureEvents) {
        document.removeEventListener(eventName, onUserGesture, { capture: true });
      }
    };
  }, [startPlayback, unmuteAndPlay]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || loadError) return;

    if (playing) {
      audio.pause();
      userStoppedRef.current = true;
      unmutePendingRef.current = false;
      return;
    }

    userStoppedRef.current = false;
    await unmuteAndPlay();
  };

  return (
    <>
      <audio ref={audioRef} autoPlay muted loop playsInline preload="auto" src={MUSIC_SRC} />

      <button
        type="button"
        onClick={() => void toggle()}
        aria-pressed={playing}
        aria-label={playing ? t.music.pause : t.music.play}
        title={playing ? t.music.pause : t.music.play}
        disabled={loadError}
        className={cn(
          "fixed bottom-5 left-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-white/90 text-zinc-900 shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 md:bottom-6 md:left-6 md:h-14 md:w-14",
          playing && "border-accent/40 bg-accent/10 text-accent",
        )}
      >
        {playing ? <Pause className="h-5 w-5" aria-hidden /> : <Music className="h-5 w-5" aria-hidden />}
        <span className="sr-only">{t.music.label}</span>
      </button>
    </>
  );
};

export default HomeBackgroundMusic;
