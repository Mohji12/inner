import { useRef, useState } from "react";
import { ImageCropDialog, type ImageCropBuildResult } from "@/components/ImageCropDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUploadError, validateImageFile } from "@/lib/imageUpload";
import { mediaUrlFromApi } from "@/lib/mediaUrl";
import { cn } from "@/lib/utils";
import type { ImageCropKind, ImageCropState } from "@/lib/cropImage";
import { toast } from "sonner";

export type PhotoCropCommit = {
  cropped: File;
  original: File | null;
  crop: ImageCropState;
  previewUrl: string;
};

type PhotoCropFieldLabels = {
  editPhoto: string;
  orPasteUrl: string;
  cropTitle: string;
  cropDescription: string;
  build: string;
  cancel: string;
  zoomHint: string;
  emptyPreview: string;
  sizeLimit: string;
};

type PhotoCropFieldProps = {
  kind: ImageCropKind;
  label: string;
  hint?: string;
  displayUrl: string | null;
  originalUrl?: string | null;
  crop?: ImageCropState | null;
  labels: PhotoCropFieldLabels;
  /** Immediate upload after Build (profile / admin). */
  onCommit?: (payload: PhotoCropCommit) => void | Promise<void>;
  /** Register: keep files locally until submit. */
  onDeferBuild?: (payload: PhotoCropCommit) => void;
  allowUrl?: boolean;
  urlValue?: string;
  onUrlChange?: (value: string) => void;
  busy?: boolean;
};

export function PhotoCropField({
  kind,
  label,
  hint,
  displayUrl,
  originalUrl,
  crop,
  labels,
  onCommit,
  onDeferBuild,
  allowUrl = true,
  urlValue = "",
  onUrlChange,
  busy = false,
}: PhotoCropFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingOriginalRef = useRef<File | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const preview = mediaUrlFromApi(displayUrl) ?? displayUrl;
  const editorSource =
    mediaUrlFromApi(originalUrl || displayUrl) ?? (originalUrl || displayUrl);
  const isBanner = kind === "banner";

  const openCrop = (src: string, originalFile: File | null) => {
    pendingOriginalRef.current = originalFile;
    if (cropSrc?.startsWith("blob:") && cropSrc !== src) {
      URL.revokeObjectURL(cropSrc);
    }
    setCropSrc(src);
    setCropOpen(true);
  };

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    const validation = validateImageFile(file, labels.sizeLimit);
    if (validation) {
      toast.error(validation);
      return;
    }
    openCrop(URL.createObjectURL(file), file);
  };

  const onEditExisting = () => {
    if (!editorSource) {
      toast.error(labels.emptyPreview);
      return;
    }
    openCrop(editorSource, null);
  };

  const handleBuild = async (result: ImageCropBuildResult) => {
    const payload: PhotoCropCommit = {
      cropped: result.file,
      original: pendingOriginalRef.current,
      crop: result.crop,
      previewUrl: URL.createObjectURL(result.file),
    };
    if (onDeferBuild) {
      onDeferBuild(payload);
      return;
    }
    if (!onCommit) return;
    setWorking(true);
    try {
      await onCommit(payload);
      pendingOriginalRef.current = null;
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <div className={cn("flex flex-col gap-4", isBanner ? "" : "sm:flex-row sm:items-start")}>
        {preview ? (
          <img
            src={preview}
            alt=""
            className={
              isBanner
                ? "h-32 w-full rounded-lg border object-cover object-center md:h-40"
                : "aspect-[4/5] w-full max-w-[11rem] rounded-xl border object-cover object-center sm:w-44"
            }
          />
        ) : (
          <div
            className={cn(
              "flex items-center justify-center rounded-xl border border-dashed bg-muted/40 text-center text-xs text-muted-foreground",
              isBanner ? "h-32 w-full md:h-40" : "aspect-[4/5] w-full max-w-[11rem] sm:w-44",
            )}
          >
            {labels.emptyPreview}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            disabled={busy || working}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              onPickFile(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || working || !editorSource}
              onClick={onEditExisting}
            >
              {labels.editPhoto}
            </Button>
          </div>
          {allowUrl ? (
            <>
              <Label className="text-xs text-muted-foreground">{labels.orPasteUrl}</Label>
              <Input
                type="url"
                placeholder="https://…"
                value={urlValue}
                disabled={busy || working}
                onChange={(e) => onUrlChange?.(e.target.value)}
              />
            </>
          ) : null}
        </div>
      </div>
      <ImageCropDialog
        open={cropOpen}
        imageSrc={cropSrc}
        kind={kind}
        initialCrop={pendingOriginalRef.current ? null : crop}
        title={labels.cropTitle}
        description={labels.cropDescription}
        buildLabel={labels.build}
        cancelLabel={labels.cancel}
        zoomHint={labels.zoomHint}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open && cropSrc?.startsWith("blob:")) {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }
        }}
        onBuild={handleBuild}
      />
    </div>
  );
}
