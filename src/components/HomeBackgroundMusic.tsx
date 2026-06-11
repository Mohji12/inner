import { useCallback, useEffect, useRef, useState } from "react";
import { Music, Pause } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import musicSrc from "@/assets/audio/morning-currencies.mp3?url";

const MUSIC_SRC = (import.meta.env.VITE_HOME_MUSIC_URL as string | undefined)?.trim() || musicSrc;
const ENTERED_KEY = "ipd_site_entered";

const HomeBackgroundMusic = () => {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);
  const userStoppedRef = useRef(false);
  const unmutePendingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [needsEnter, setNeedsEnter] = useState(false);

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
      setNeedsEnter(false);
      sessionStorage.setItem(ENTERED_KEY, "1");
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
      setNeedsEnter(false);
      sessionStorage.setItem(ENTERED_KEY, "1");
      return true;
    } catch {
      try {
        audio.muted = true;
        await audio.play();
        unmutePendingRef.current = true;
        return true;
      } catch {
        audio.muted = false;
        return false;
      }
    }
  }, []);

  const enterSite = useCallback(async () => {
    userStoppedRef.current = false;
    const ok = await unmuteAndPlay();
    if (!ok) {
      await startPlayback();
      if (unmutePendingRef.current) {
        await unmuteAndPlay();
      }
    }
  }, [startPlayback, unmuteAndPlay]);

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

      const ok = await startPlayback();
      if (cancelled) return;

      if (!ok) {
        setNeedsEnter(true);
        return;
      }

      if (unmutePendingRef.current) {
        setNeedsEnter(sessionStorage.getItem(ENTERED_KEY) !== "1");
      }
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

      {needsEnter && !loadError ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-6 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={t.music.enterTitle}
        >
          <button
            type="button"
            onClick={() => void enterSite()}
            className="max-w-md rounded-2xl border border-white/50 bg-white/95 px-10 py-8 text-center shadow-2xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <p className="font-serif text-3xl font-semibold text-heading">{t.music.enterTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t.music.enterHint}</p>
            <span className="mt-6 inline-flex rounded-xl gradient-cta px-8 py-3 text-sm font-medium text-white">
              {t.music.enterAction}
            </span>
          </button>
        </div>
      ) : null}

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
