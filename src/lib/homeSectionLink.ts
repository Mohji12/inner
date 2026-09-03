import type { To } from "react-router-dom";

/** Hash link on home, or navigate to home section from other routes (Safari-friendly via React Router). */
export function homeSectionTo(pathname: string, hash: string): To {
  const normalized = hash.startsWith("#") ? hash : `#${hash}`;
  return pathname === "/" ? normalized : { pathname: "/", hash: normalized };
}

export function scrollToHomeSection(hash: string) {
  const id = hash.replace(/^#/, "");
  if (!id) return;
  const run = () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
}
