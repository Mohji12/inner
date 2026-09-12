import type { MentorPresenceStatus } from "@/api/mentors";

type PresenceCopy = {
  presenceOnline: string;
  presenceOnlineHint: string;
  presenceBusy: string;
  presenceBusyHint: string;
  presencePaused: string;
  presencePausedHint: string;
  presenceOccupied: string;
  presenceOccupiedHint: string;
  presenceUnavailable: string;
  presenceUnavailableHint: string;
  presenceOffline: string;
  presenceOfflineHint: string;
};

export function mentorPresenceLabel(status: MentorPresenceStatus["status"], copy: PresenceCopy): string {
  if (status === "online") return copy.presenceOnline;
  if (status === "busy") return copy.presenceBusy;
  if (status === "paused") return copy.presencePaused;
  if (status === "occupied") return copy.presenceOccupied;
  if (status === "unavailable") return copy.presenceUnavailable;
  return copy.presenceOffline;
}

export function mentorPresenceHint(status: MentorPresenceStatus["status"], copy: PresenceCopy): string {
  if (status === "online") return copy.presenceOnlineHint;
  if (status === "busy") return copy.presenceBusyHint;
  if (status === "paused") return copy.presencePausedHint;
  if (status === "occupied") return copy.presenceOccupiedHint;
  if (status === "unavailable") return copy.presenceUnavailableHint;
  return copy.presenceOfflineHint;
}

export function mentorPresenceVisibleToUsers(status: MentorPresenceStatus["status"]): boolean {
  return status === "online";
}
