import { getApiV1BaseUrl } from "./constants";

function uploadsUrl(suffix: string): string {
  const base = getApiV1BaseUrl().replace(/\/$/, "");
  return `${base}/upload/${suffix}`;
}

/** Pending mentors (no login yet): email + password prove identity. Saves to Cloudinary when configured. */
export async function uploadRegistrationMentorAvatar(params: {
  email: string;
  password: string;
  file: File;
}): Promise<string> {
  const body = new FormData();
  body.append("file", params.file);
  body.append("email", params.email.trim().toLowerCase());
  body.append("password", params.password);
  const res = await fetch(uploadsUrl("mentor-register-avatar"), {
    method: "POST",
    body,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { detail?: string | { message?: string } };
      if (typeof j.detail === "string") msg = j.detail;
      else if (j.detail && typeof j.detail === "object" && "message" in j.detail) {
        msg = String((j.detail as { message?: string }).message ?? msg);
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as { url: string };
  if (!data.url) throw new Error("Invalid upload response");
  return data.url;
}
