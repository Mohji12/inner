import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  aspectForKind,
  getCroppedJpegFile,
  type ImageCropKind,
  type ImageCropState,
} from "@/lib/cropImage";
import { toast } from "sonner";

export type ImageCropBuildResult = {
  file: File;
  crop: ImageCropState;
};

type ImageCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  kind: ImageCropKind;
  initialCrop?: ImageCropState | null;
  title: string;
  description?: string;
  buildLabel: string;
  cancelLabel: string;
  zoomHint: string;
  onOpenChange: (open: boolean) => void;
  onBuild: (result: ImageCropBuildResult) => void | Promise<void>;
};

export function ImageCropDialog({
  open,
  imageSrc,
  kind,
  initialCrop,
  title,
  description,
  buildLabel,
  cancelLabel,
  zoomHint,
  onOpenChange,
  onBuild,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: initialCrop?.x ?? 0, y: initialCrop?.y ?? 0 });
  const [zoom, setZoom] = useState(initialCrop?.zoom ?? 1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    initialCrop?.croppedAreaPixels ?? null,
  );
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: initialCrop?.x ?? 0, y: initialCrop?.y ?? 0 });
    setZoom(initialCrop?.zoom ?? 1);
    setCroppedAreaPixels(initialCrop?.croppedAreaPixels ?? null);
    // Only reset when a new image is opened, not on parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next && building) return;
    if (next && initialCrop) {
      setCrop({ x: initialCrop.x ?? 0, y: initialCrop.y ?? 0 });
      setZoom(initialCrop.zoom ?? 1);
      setCroppedAreaPixels(initialCrop.croppedAreaPixels ?? null);
    }
    if (!next) {
      setBuilding(false);
    }
    onOpenChange(next);
  };

  const handleBuild = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setBuilding(true);
    try {
      const file = await getCroppedJpegFile(
        imageSrc,
        croppedAreaPixels,
        kind === "banner" ? "banner.jpg" : "profile.jpg",
      );
      try {
        await onBuild({
          file,
          crop: {
            x: crop.x,
            y: crop.y,
            zoom,
            croppedAreaPixels,
          },
        });
        onOpenChange(false);
      } catch {
        /* Upload/commit errors are toasted by the caller. Keep the editor open. */
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build the cropped image.");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <Dialog open={open && Boolean(imageSrc)} onOpenChange={handleOpenChange}>
      <DialogContent className="z-[60] max-w-lg gap-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="relative h-[min(62vh,28rem)] w-full overflow-hidden rounded-lg bg-muted">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspectForKind(kind)}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              restrictPosition
              showGrid
              style={{ containerStyle: { background: "hsl(var(--muted))" } }}
            />
          ) : null}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{zoomHint}</p>
          <Slider
            min={1}
            max={3}
            step={0.05}
            value={[zoom]}
            onValueChange={(v) => setZoom(v[0] ?? 1)}
            disabled={building}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={building} onClick={() => handleOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="button" disabled={building || !croppedAreaPixels} onClick={() => void handleBuild()}>
            {building ? `${buildLabel}…` : buildLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
