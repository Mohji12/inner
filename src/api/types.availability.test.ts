import { describe, expect, it } from "vitest";
import { getMentorAvailabilityStatus } from "@/api/types";

describe("getMentorAvailabilityStatus", () => {
  it("returns paused when coach is online but manually occupied", () => {
    expect(
      getMentorAvailabilityStatus({
        is_online: true,
        chat_available: false,
        chat_price_per_minute: "1.00",
        unavailable_now: false,
        manual_occupied: true,
      }),
    ).toBe("paused");
  });

  it("returns busy when online, not available, and not occupied", () => {
    expect(
      getMentorAvailabilityStatus({
        is_online: true,
        chat_available: false,
        chat_price_per_minute: "1.00",
        unavailable_now: false,
        manual_occupied: false,
      }),
    ).toBe("busy");
  });

  it("returns available when chat_available", () => {
    expect(
      getMentorAvailabilityStatus({
        is_online: true,
        chat_available: true,
        chat_price_per_minute: "1.00",
        unavailable_now: false,
        manual_occupied: false,
      }),
    ).toBe("available");
  });
});
