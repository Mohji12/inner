/** Shared image upload helpers for profile/avatar forms. */

/** Public cropped image sent as `file` — keep under Cloudinary-friendly size. */
export const MAX_CROPPED_IMAGE_BYTES = 2 * 1024 * 1024;
/** Raw camera original sent as `original` — phone photos are often 3–10 MB. */
export const MAX_ORIGINAL_IMAGE_BYTES = 12 * 1024 * 1024;
/** After client compress, originals should fit this before upload. */
export const ORIGINAL_UPLOAD_TARGET_BYTES = 4 * 1024 * 1024;

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

export function validateImageFile(
  file: File,
  sizeLimitMessage = "Image size should be less than 2 MB.",
  maxBytes = MAX_CROPPED_IMAGE_BYTES,
): string | null {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();

  if (HEIC_TYPES.has(type) || /\.(heic|heif)$/i.test(name)) {
    return "HEIC/HEIF photos are not supported. Please export or convert to JPG or PNG in your Photos app and try again.";
  }

  const typedOk = Boolean(type && type.startsWith("image/"));
  const extOk = /\.(jpe?g|png|gif|webp|bmp)$/i.test(name);
  // Safari/Photos sometimes omits both MIME type and filename.
  const macPhotosMystery = file.size > 0 && !type && !name;
  if (!typedOk && !extOk && !macPhotosMystery) {
    return "File must be an image (JPG, PNG, WebP, or GIF). HEIC from iPhone is not supported.";
  }
  if (file.size > maxBytes) {
    return sizeLimitMessage;
  }
  if (file.size === 0) {
    return "The selected file is empty.";
  }
  return null;
}

/** Downscale/compress a large phone photo so it can be uploaded as `original`. */
export async function compressImageForUpload(
  file: File,
  maxBytes = ORIGINAL_UPLOAD_TARGET_BYTES,
  maxEdge = 2400,
): Promise<File> {
  if (file.size <= maxBytes && file.type === "image/jpeg") {
    return file;
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read the selected image."));
      img.src = objectUrl;
    });
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const w = Math.max(1, Math.round(image.naturalWidth * scale));
    const h = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process the selected image.");
    ctx.drawImage(image, 0, 0, w, h);

    let quality = 0.88;
    const toBlob = (q: number) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress the image."))),
          "image/jpeg",
          q,
        );
      });
    let blob = await toBlob(quality);
    while (blob.size > maxBytes && quality > 0.45) {
      quality -= 0.08;
      blob = await toBlob(quality);
    }
    if (blob.size > MAX_ORIGINAL_IMAGE_BYTES) {
      throw new Error("Image is still too large after compression. Try a smaller photo.");
    }
    const base = (file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
    return "Upload failed (network). Check your connection, stay on this page, and use a JPG/PNG (not HEIC).";
  }
  if (lower.includes("field required") || lower.includes("field is required")) {
    return "The image file was not received. Please choose a JPG or PNG (not HEIC) and try again.";
  }
  return msg || fallback;
}
