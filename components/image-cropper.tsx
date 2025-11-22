"use client";

import { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";
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
import { ImageDimensions, cropAndResizeImage, blobToFile } from "@/lib/image-utils";
import { Loader2 } from "lucide-react";

interface ImageCropperProps {
  imageSrc: string;
  imageFile: File;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedFile: File) => void;
  imageDimensions: ImageDimensions;
  isLandscape: boolean;
  targetDimensions: string; // e.g., "1280x720" or "720x1280"
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ImageCropper({
  imageSrc,
  imageFile,
  isOpen,
  onClose,
  onCropComplete,
  imageDimensions,
  isLandscape,
  targetDimensions,
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate aspect ratio from target dimensions (e.g., "1280x720" -> 16/9)
  const [targetWidth, targetHeight] = targetDimensions.split('x').map(Number);
  const aspectRatio = targetWidth / targetHeight;

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [isOpen]);

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom);
  }, []);

  const onCropCompleteCallback = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSave = async () => {
    if (!croppedAreaPixels) {
      return;
    }

    setIsProcessing(true);
    try {
      // Crop and resize the image to target dimensions
      const blob = await cropAndResizeImage(
        imageSrc,
        croppedAreaPixels,
        targetDimensions
      );

      // Convert blob to File
      const croppedFile = blobToFile(
        blob,
        imageFile.name || "cropped-image.jpg",
        imageFile.type || "image/jpeg"
      );

      // Verify the cropped image dimensions
      const [targetWidth, targetHeight] = targetDimensions.split('x').map(Number);
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        console.log(`[ImageCropper] Cropped image dimensions: ${img.width}x${img.height}, target: ${targetWidth}x${targetHeight}`);
        if (img.width !== targetWidth || img.height !== targetHeight) {
          console.error(`[ImageCropper] WARNING: Image dimensions don't match! Got ${img.width}x${img.height}, expected ${targetWidth}x${targetHeight}`);
        }
      };
      img.src = url;

      onCropComplete(croppedFile);
      onClose();
    } catch (error) {
      console.error("Error cropping image:", error);
      alert("Failed to process image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-6 gap-4">
        <DialogHeader>
          <DialogTitle>
            Crop Image - {isLandscape ? "Landscape (16:9)" : "Portrait (9:16)"}
          </DialogTitle>
          <DialogDescription>
            Adjust the crop area to select the portion of the image you want to use.
            The image will be resized to {targetDimensions} pixels.
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative w-full flex-shrink-0" style={{ height: "500px" }}>
          <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
            {imageSrc ? (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropCompleteCallback}
                cropShape="rect"
                showGrid={true}
                style={{
                  containerStyle: {
                    width: "100%",
                    height: "100%",
                    position: "relative",
                  },
                  cropAreaStyle: {
                    border: "2px solid rgba(255, 255, 255, 0.8)",
                  },
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white">
                <p>No image provided</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Zoom</label>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(value) => setZoom(value[0])}
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Save & Continue"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

