/** Crop framing persisted with a coach photo so the editor can restore pan/zoom. */

export type CroppedAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageCropState = {
  x: number;
  y: number;
  zoom: number;
  croppedAreaPixels?: CroppedAreaPixels;
};

export function parseStoredCrop(raw: unknown): ImageCropState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const x = typeof o.x === "number" ? o.x : 0;
  const y = typeof o.y === "number" ? o.y : 0;
  const zoom = typeof o.zoom === "number" && o.zoom > 0 ? o.zoom : 1;
  const pixels = o.croppedAreaPixels;
  let croppedAreaPixels: CroppedAreaPixels | undefined;
  if (pixels && typeof pixels === "object") {
    const p = pixels as Record<string, unknown>;
    if (
      typeof p.x === "number" &&
      typeof p.y === "number" &&
      typeof p.width === "number" &&
      typeof p.height === "number"
    ) {
      croppedAreaPixels = { x: p.x, y: p.y, width: p.width, height: p.height };
    }
  }
  return { x, y, zoom, croppedAreaPixels };
}

export type ImageCropKind = "avatar" | "banner";

export const PROFILE_CROP_ASPECT = 4 / 5;
export const BANNER_CROP_ASPECT = 3 / 1;
export const CROP_MAX_EDGE_PX = 1200;
export const CROP_MAX_BYTES = 2 * 1024 * 1024;

export function aspectForKind(kind: ImageCropKind): number {
  return kind === "banner" ? BANNER_CROP_ASPECT : PROFILE_CROP_ASPECT;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (event) => reject(event));
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

async function resolveDrawableSrc(src: string): Promise<{ url: string; revoke: boolean }> {
  if (src.startsWith("blob:") || src.startsWith("data:")) {
    return { url: src, revoke: false };
  }
  try {
    const res = await fetch(src, {
      mode: "cors",
      credentials: src.includes("/uploads/") ? "include" : "omit",
    });
    if (!res.ok) {
      return { url: src, revoke: false };
    }
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), revoke: true };
  } catch {
    return { url: src, revoke: false };
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not build the cropped image."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/** Draw the selected pixel crop onto a JPEG, shrinking so the long edge is at most `maxEdge`. */
export async function getCroppedJpegFile(
  imageSrc: string,
  pixelCrop: CroppedAreaPixels,
  filename = "photo.jpg",
  maxEdge = CROP_MAX_EDGE_PX,
): Promise<File> {
  const resolved = await resolveDrawableSrc(imageSrc);
  try {
    const image = await createImage(resolved.url);
    const scale = Math.min(1, maxEdge / Math.max(pixelCrop.width, pixelCrop.height));
    const outW = Math.max(1, Math.round(pixelCrop.width * scale));
    const outH = Math.max(1, Math.round(pixelCrop.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not build the cropped image.");
    }
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      outW,
      outH,
    );

    let quality = 0.9;
    let blob = await canvasToJpegBlob(canvas, quality);
    while (blob.size > CROP_MAX_BYTES && quality > 0.5) {
      quality -= 0.1;
      blob = await canvasToJpegBlob(canvas, quality);
    }
    if (blob.size > CROP_MAX_BYTES) {
      throw new Error("Cropped image is larger than 2 MB. Try zooming in or using a smaller photo.");
    }
    return new File([blob], filename, { type: "image/jpeg" });
  } finally {
    if (resolved.revoke) URL.revokeObjectURL(resolved.url);
  }
}
