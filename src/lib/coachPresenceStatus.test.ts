import { describe, expect, it } from "vitest";
import { mentorPresenceHint, mentorPresenceLabel, mentorPresenceVisibleToUsers } from "@/lib/coachPresenceStatus";

const copy = {
  presenceOnline: "Online",
  presenceOnlineHint: "Users can book",
  presenceBusy: "Busy",
  presenceBusyHint: "In session",
  presenceOccupied: "Occupied",
  presenceOccupiedHint: "Manual occupied",
  presenceUnavailable: "Unavailable",
  presenceUnavailableHint: "Schedule block",
  presenceOffline: "Offline",
  presenceOfflineHint: "Offline hint",
};

describe("coachPresenceStatus", () => {
  it("maps unavailable status for coach dashboard", () => {
    expect(mentorPresenceLabel("unavailable", copy)).toBe("Unavailable");
    expect(mentorPresenceVisibleToUsers("unavailable")).toBe(false);
    expect(mentorPresenceVisibleToUsers("online")).toBe(true);
  });

  it("maps occupied status", () => {
    expect(mentorPresenceLabel("occupied", copy)).toBe("Occupied");
    expect(mentorPresenceHint("occupied", copy)).toBe("Manual occupied");
    expect(mentorPresenceVisibleToUsers("occupied")).toBe(false);
  });
});
