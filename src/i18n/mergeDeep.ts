/** Shallow-safe deep merge for plain JSON-like objects (no arrays). */
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export function mergeDeep<T extends object>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const pv = patch[key];
    const bv = base[key];
    if (pv !== undefined && typeof pv === "object" && pv !== null && !Array.isArray(pv) && typeof bv === "object" && bv !== null && !Array.isArray(bv)) {
      out[key as string] = mergeDeep(bv as object, pv as DeepPartial<object>) as unknown;
    } else if (pv !== undefined) {
      out[key as string] = pv as unknown;
    }
  }
  return out as T;
}
