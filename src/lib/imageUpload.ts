/** Shared image upload helpers for profile/avatar forms. */

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const HEIC_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

/**
 * Safari/macOS often sends Files with an empty name. FastAPI then treats the
 * multipart part as a text field and returns 422 "Field required".
 */
export function appendNamedFile(form: FormData, field: string, blob: Blob, fallbackName: string): void {
  const fromFile = blob instanceof File ? blob.name.trim() : "";
  const name = fromFile || fallbackName;
  const type = blob.type || (name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
  // Re-wrap as Blob so Safari/macOS always includes a filename in the multipart part.
  form.append(field, new Blob([blob], { type }), name);
}

export function validateImageFile(file: File, sizeLimitMessage = "Image size should be less than 2 MB."): string | null {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();

  if (HEIC_TYPES.has(type) || /\.(heic|heif)$/i.test(name)) {
    return "HEIC/HEIF photos are not supported. Please export or convert to JPG or PNG and try again.";
  }

  const typedOk = Boolean(type && type.startsWith("image/"));
  const extOk = /\.(jpe?g|png|gif|webp|bmp)$/i.test(name);
  // Safari/Photos sometimes omits both MIME type and filename.
  const macPhotosMystery = file.size > 0 && !type && !name;
  if (!typedOk && !extOk && !macPhotosMystery) {
    return "File must be an image (JPG, PNG, WebP, or GIF).";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return sizeLimitMessage;
  }
  if (file.size === 0) {
    return "The selected file is empty.";
  }
  return null;
}

/** Map cryptic browser/Safari network errors to actionable copy. */
export function formatUploadError(err: unknown, fallback = "Failed to upload image"): string {
  if (!(err instanceof Error)) return fallback;
  const msg = (err.message || "").trim();
  const lower = msg.toLowerCase();
  if (
    lower === "load failed" ||
    lower === "failed to fetch" ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("the internet connection appears to be offline")
  ) {
    return "Upload failed (network). Check your connection, stay on this page, and use a JPG/PNG under 2 MB.";
  }
  if (lower.includes("field required") || lower.includes("field is required")) {
    return "The image file was not received. Please choose a JPG or PNG (not HEIC) under 2 MB and try again.";
  }
  return msg || fallback;
}
