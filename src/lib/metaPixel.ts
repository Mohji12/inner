const META_PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() ?? "";

let initialized = false;

export function isMetaPixelEnabled(): boolean {
  return META_PIXEL_ID.length > 0;
}

export function initMetaPixel(): void {
  if (!isMetaPixelEnabled() || initialized || typeof window === "undefined") {
    return;
  }

  const inject = (
    f: Window,
    b: Document,
    e: string,
    v: string,
    n?: Fbq,
    t?: HTMLScriptElement,
    s?: Element | null,
  ) => {
    if (f.fbq) return;
    n = f.fbq = function (...args: unknown[]) {
      if (n!.callMethod) {
        n!.callMethod(...args);
      } else {
        n!.queue.push(args);
      }
    } as Fbq;
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s?.parentNode?.insertBefore(t, s);
  };

  inject(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  window.fbq!("init", META_PIXEL_ID);
  initialized = true;
}

export function trackPageView(): void {
  if (!isMetaPixelEnabled() || !initialized || typeof window === "undefined" || !window.fbq) {
    return;
  }
  window.fbq("track", "PageView");
}
