import { describe, expect, it } from "vitest";
import { bookingSessionEndAt, formatSessionBookingSummary } from "./sessionBooking";

describe("bookingSessionEndAt", () => {
  it("uses start + duration when stored end is the 30-min join window", () => {
    const end = bookingSessionEndAt({
      start_at_utc: "2026-09-08T08:57:00.000Z",
      end_at_utc: "2026-09-08T09:27:00.000Z",
      duration_minutes: 5,
    });
    expect(end.toISOString()).toBe("2026-09-08T09:02:00.000Z");
  });

  it("uses duration field from bookings list", () => {
    const end = bookingSessionEndAt({
      start_at_utc: "2026-09-08T08:57:00.000Z",
      end_at_utc: "2026-09-08T09:27:00.000Z",
      duration: 5,
    });
    expect(end.toISOString()).toBe("2026-09-08T09:02:00.000Z");
  });
});

describe("formatSessionBookingSummary", () => {
  it("shows billed duration window, not join deadline", () => {
    const { primary } = formatSessionBookingSummary(
      {
        booking_id: "b1",
        duration_minutes: 5,
        booked_at: "2026-09-08T08:57:00.000Z",
        start_at_utc: "2026-09-08T08:57:00.000Z",
        end_at_utc: "2026-09-08T09:27:00.000Z",
        communication_mode: "call",
      },
      "UTC",
    );
    expect(primary).toContain("08:57");
    expect(primary).toContain("09:02");
    expect(primary).not.toContain("09:27");
    expect(primary).toContain("5 min");
    expect(primary).toContain("Phone call");
  });
});
