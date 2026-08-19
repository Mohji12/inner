import { getApiV1BaseUrl } from "./constants";
import { apiFetch } from "./client";
import { appendNamedFile } from "@/lib/imageUpload";
import type { ImageCropKind, ImageCropState } from "@/lib/cropImage";

function uploadsUrl(suffix: string): string {
  const base = getApiV1BaseUrl().replace(/\/$/, "");
  return `${base}/upload/${suffix}`;
}

export type MentorPhotoUploadResult = {
  url: string;
  original_url?: string | null;
};

function appendPhotoForm(params: {
  cropped: File;
  original?: File | null;
  crop?: ImageCropState | null;
}): FormData {
  const body = new FormData();
  appendNamedFile(body, "file", params.cropped, "photo.jpg");
  if (params.original) appendNamedFile(body, "original", params.original, "original.jpg");
  if (params.crop) body.append("crop", JSON.stringify(params.crop));
  return body;
}

export async function uploadMentorPhoto(params: {
  kind: ImageCropKind;
  cropped: File;
  original?: File | null;
  crop?: ImageCropState | null;
}): Promise<MentorPhotoUploadResult> {
  const path = params.kind === "banner" ? "/upload/banner" : "/upload/avatar";
  return apiFetch<MentorPhotoUploadResult>(path, {
    method: "POST",
    body: appendPhotoForm(params),
  });
}

/** Pending mentors (no login yet): email + password prove identity. Saves to Cloudinary when configured. */
export async function uploadRegistrationMentorAvatar(params: {
  email: string;
  password: string;
  file: File;
  original?: File | null;
  crop?: ImageCropState | null;
}): Promise<string> {
  const body = appendPhotoForm({
    cropped: params.file,
    original: params.original,
    crop: params.crop,
  });
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
