import { describe, expect, it } from "vitest";
import { canDownloadBookingInvoice, canOpenBookingChat, isBookingSessionEnded } from "./bookingChatLinks";

const baseBooking = {
  status: "confirmed" as const,
  payment_status: "paid" as const,
  end_at_utc: "2026-05-24T12:00:00.000Z",
};

describe("isBookingSessionEnded", () => {
  it("returns true when booking end time is in the past", () => {
    expect(
      isBookingSessionEnded(baseBooking, null, new Date("2026-05-24T12:05:00.000Z")),
    ).toBe(true);
  });

  it("returns true when linked chat is ended", () => {
    expect(
      isBookingSessionEnded(baseBooking, { status: "ended", remaining_seconds: 0 }, new Date("2026-05-24T11:00:00.000Z")),
    ).toBe(true);
  });

  it("returns false for upcoming confirmed paid booking", () => {
    expect(
      isBookingSessionEnded(baseBooking, null, new Date("2026-05-24T11:00:00.000Z")),
    ).toBe(false);
  });
});

describe("canDownloadBookingInvoice", () => {
  it("allows download for ended confirmed paid booking", () => {
    expect(
      canDownloadBookingInvoice(baseBooking, { status: "ended", remaining_seconds: 0 }, new Date("2026-05-24T12:05:00.000Z")),
    ).toBe(true);
  });

  it("blocks download while session is still active", () => {
    expect(
      canDownloadBookingInvoice(
        baseBooking,
        { status: "active", remaining_seconds: 120 },
        new Date("2026-05-24T11:55:00.000Z"),
      ),
    ).toBe(false);
  });

  it("allows download when user ended chat early but booking window remains", () => {
    expect(
      canDownloadBookingInvoice(
        baseBooking,
        { status: "ended", remaining_seconds: 180 },
        new Date("2026-05-24T11:55:00.000Z"),
      ),
    ).toBe(true);
  });

  it("does not allow reopening chat after early end", () => {
    expect(
      canOpenBookingChat(
        { ...baseBooking, meeting_link: "/user/chat/abc?mode=call" },
        { status: "ended", remaining_seconds: 180 },
        new Date("2026-05-24T11:55:00.000Z"),
      ),
    ).toBe(false);
  });

  it("allows download for completed bookings", () => {
    expect(
      canDownloadBookingInvoice(
        { ...baseBooking, status: "completed" },
        null,
        new Date("2026-05-24T11:00:00.000Z"),
      ),
    ).toBe(true);
  });
});
