"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onehash/ui/dialog";
import { Button } from "@onehash/ui/button";
import { Label } from "@onehash/ui/label";
import { Slider } from "@onehash/ui/slider";
import { getCroppedImageBlob } from "@/lib/image-crop";
import { toast } from "@onehash/ui/sonner";

export type ImageCropDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  /** Width/height of the square output in pixels (default 512). */
  outputSize?: number;
  title?: string;
  description?: string;
  onCropComplete: (file: File) => void;
};

export function ImageCropDialog({
  open,
  onOpenChange,
  imageSrc,
  outputSize = 512,
  title = "Adjust image",
  description = "Drag to reposition and use the zoom slider to frame your image.",
  onCropComplete,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (open && imageSrc) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open, imageSrc]);

  const onCropCompleteCb = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setApplying(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, outputSize);
      const file = new File([blob], "image.png", { type: "image/png" });
      onCropComplete(file);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not process image");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg gap-4">
        <DialogHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {imageSrc ? (
          <div className="relative h-[min(50vh,320px)] w-full overflow-hidden rounded-lg bg-muted">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropCompleteCb}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Zoom</Label>
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.02}
            onValueChange={(v) => setZoom(v[0] ?? 1)}
            className="py-1"
          />
        </div>

        <DialogFooter className="mt-0 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={applying}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleApply()}
            disabled={!croppedAreaPixels || applying}
            pending={applying}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
