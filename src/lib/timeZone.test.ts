import { describe, expect, it } from "vitest";
import { formatTimeLocal, parseApiUtcDate } from "@/lib/timeZone";

describe("parseApiUtcDate", () => {
  it("treats naive ISO timestamps as UTC", () => {
    const d = parseApiUtcDate("2026-09-08T08:57:45.304974");
    expect(d.toISOString()).toBe("2026-09-08T08:57:45.304Z");
  });

  it("keeps explicit Z / offsets", () => {
    expect(parseApiUtcDate("2026-09-08T08:57:45.304974Z").toISOString()).toBe("2026-09-08T08:57:45.304Z");
    expect(parseApiUtcDate("2026-09-08T14:27:45.304974+05:30").toISOString()).toBe("2026-09-08T08:57:45.304Z");
  });

  it("formats naive UTC into Asia/Kolkata local wall time", () => {
    // 08:57 UTC → 14:27 IST
    expect(formatTimeLocal("2026-09-08T08:57:00", undefined, "Asia/Kolkata")).toBe("14:27");
  });
});
