/** Resolve `/uploads/...` paths to absolute URL against API origin */
export function mediaUrlFromApi(pathOrUrl: string | null | undefined): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const raw = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  const base = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/v1\/?$/, "");
  if (!base) return raw;
  return `${base.replace(/\/$/, "")}${raw}`;
}
