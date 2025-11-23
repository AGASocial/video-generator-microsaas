"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, X, Sparkles } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getCreditCost } from "@/lib/products";
import { Switch, SwitchThumb } from "@radix-ui/react-switch";
import { ImageCropper } from "@/components/image-cropper";
import { getImageDimensions, isLandscape, ImageDimensions } from "@/lib/image-utils";
import { useTranslations } from 'next-intl';

interface PredefinedPrompt {
  id: string;
  title: string;
  prompt: string;
  category?: string;
  description?: string;
}

interface VideoGeneratorFormProps {
  userCredits: number;
}

export function VideoGeneratorForm({ userCredits }: VideoGeneratorFormProps) {
  const t = useTranslations('form');
  const [prompt, setPrompt] = useState("");
  const [selectedPredefinedPrompt, setSelectedPredefinedPrompt] = useState<string>("");
  const [predefinedPrompts, setPredefinedPrompts] = useState<PredefinedPrompt[]>([]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true);
  const [duration, setDuration] = useState("8"); // 4, 8, 12 seconds
  const [model, setModel] = useState("sora-2-pro");
  const [dimensions, setDimensions] = useState("1280x720");
  const [soundEffect, setSoundEffect] = useState("no");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Fetch predefined prompts on component mount
  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const response = await fetch("/api/prompts");
        const data = await response.json();
        
        if (data.success && data.prompts) {
          setPredefinedPrompts(data.prompts);
        }
      } catch (error) {
        console.error("Error fetching predefined prompts:", error);
      } finally {
        setIsLoadingPrompts(false);
      }
    };

    fetchPrompts();
  }, []);

  // Handle predefined prompt selection
  const handlePredefinedPromptChange = (value: string) => {
    setSelectedPredefinedPrompt(value);
    if (value === "custom") {
      setPrompt("");
    } else {
      const selected = predefinedPrompts.find((p) => p.id === value);
      if (selected) {
        setPrompt(selected.prompt);
      }
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Store original file and preview
        setOriginalImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          const preview = reader.result as string;
          setOriginalImagePreview(preview);
          
          // Get image dimensions to detect orientation
          getImageDimensions(file).then((dims) => {
            setImageDimensions(dims);
            
            // Auto-update dimensions selector based on image orientation
            const imageIsLandscape = isLandscape(dims);
            const shouldBeLandscape = imageIsLandscape;
            const newDimensions = shouldBeLandscape ? "1280x720" : "720x1280";
            
            // Only update if different to avoid unnecessary re-renders
            if (dimensions !== newDimensions) {
              setDimensions(newDimensions);
              toast({
                title: t('dimensionsUpdated'),
                description: t('dimensionsUpdatedDesc', { dimensions: newDimensions }),
              });
            }
            
            // Open cropper dialog
            setIsCropperOpen(true);
          }).catch((error) => {
            console.error("Error getting image dimensions:", error);
            toast({
              title: t('errorLoadingImage'),
              description: t('errorLoadingImageDesc'),
              variant: "destructive",
            });
          });
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Error handling image:", error);
        toast({
          title: t('errorProcessingImage'),
          description: t('errorProcessingImageDesc'),
          variant: "destructive",
        });
      }
    }
  };

  const handleCropComplete = (croppedFile: File) => {
    console.log("[Form] Crop complete, received file:", {
      name: croppedFile.name,
      type: croppedFile.type,
      size: croppedFile.size,
    });
    
    // Update the image file with the cropped version
    setImageFile(croppedFile);
    
    // Update preview with cropped image
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      console.log("[Form] Image preview updated");
    };
    reader.readAsDataURL(croppedFile);
    
    setIsCropperOpen(false);
    toast({
      title: t('imageCropped'),
      description: t('imageCroppedDesc'),
    });
  };

  const handleCropperClose = () => {
    // If user closes cropper without saving, remove the image
    // Don't keep the original - user must crop to proceed
    setImageFile(null);
    setImagePreview(null);
    setOriginalImageFile(null);
    setOriginalImagePreview(null);
    setImageDimensions(null);
    setIsCropperOpen(false);
    
    toast({
      title: t('imageRemoved'),
      description: t('imageRemovedDesc'),
    });
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setOriginalImageFile(null);
    setOriginalImagePreview(null);
    setImageDimensions(null);
  };

  // Calculate credit cost based on selected model
  const creditCost = useMemo(() => getCreditCost(model), [model]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVideoUrl(null);

    if (userCredits < creditCost) {
      const plural = creditCost > 1 ? 's' : '';
      setError(t('insufficientCreditsError', { cost: creditCost, plural }));
      toast({
        title: t('insufficientCredits'),
        description: t('insufficientCreditsDesc', { cost: creditCost, plural, credits: userCredits }),
        variant: "destructive",
      });
      router.push("/credits");
      return;
    }

    setIsLoading(true);

    try {
      // If we have a preview but no file, recreate the file from the preview
      let finalImageFile = imageFile;
      if (imagePreview && !imageFile) {
        console.log("[Form] Recreating file from preview data URL");
        try {
          // Convert data URL to blob, then to File
          const response = await fetch(imagePreview);
          const blob = await response.blob();
          finalImageFile = new File([blob], "reference.jpg", { type: blob.type || "image/jpeg" });
          console.log("[Form] Recreated file:", {
            name: finalImageFile.name,
            type: finalImageFile.type,
            size: finalImageFile.size,
          });
          // Update state for next time
          setImageFile(finalImageFile);
        } catch (recreateError) {
          console.error("[Form] Failed to recreate file from preview:", recreateError);
          const errorMsg = t('imageErrorDesc');
          setError(errorMsg);
          toast({
            title: t('imageError'),
            description: errorMsg,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      // If we have an image, verify it matches the selected dimensions
      if (finalImageFile) {
        console.log("[Form] Submitting with image file:", {
          name: finalImageFile.name,
          type: finalImageFile.type,
          size: finalImageFile.size,
        });
        try {
          const [targetWidth, targetHeight] = dimensions.split('x').map(Number);
          const imageDims = await getImageDimensions(finalImageFile);
          console.log("[Form] Image dimensions:", imageDims, "Target:", { targetWidth, targetHeight });
          
          if (imageDims.width !== targetWidth || imageDims.height !== targetHeight) {
            const errorMsg = t('dimensionMismatchDesc', { 
              imageDims: `${imageDims.width}x${imageDims.height}`, 
              targetDims: `${targetWidth}x${targetHeight}` 
            });
            setError(errorMsg);
            toast({
              title: t('dimensionMismatch'),
              description: errorMsg,
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
        } catch (dimError) {
          console.error("Error verifying image dimensions:", dimError);
          // Continue anyway - better to try than fail silently
        }
      } else {
        console.log("[Form] Submitting without image file");
      }

      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("duration", duration);
      formData.append("model", model);
      formData.append("size", dimensions);
      
      // Verify finalImageFile exists and is a valid File object
      if (finalImageFile && finalImageFile instanceof File) {
        console.log("[Form] Appending image file:", {
          name: finalImageFile.name,
          type: finalImageFile.type,
          size: finalImageFile.size,
          isFile: finalImageFile instanceof File,
        });
        formData.append("image", finalImageFile, finalImageFile.name || "reference.jpg");
        
        // Verify it was added to FormData
        const formDataImage = formData.get("image");
        console.log("[Form] FormData image check:", formDataImage ? "Present" : "Missing", formDataImage);
      } else {
        console.warn("[Form] No valid image file to send. finalImageFile:", finalImageFile);
        if (imagePreview) {
          console.warn("[Form] WARNING: imagePreview exists but finalImageFile is missing!");
        }
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate video");
      }

      // Handle response
      if (data.status === "completed" && data.videoUrl) {
        // Video is ready immediately
        setVideoUrl(data.videoUrl);
        setVideoId(data.videoId);
        toast({
          title: t('videoGenerated'),
          description: t('videoGeneratedDesc'),
        });
        setIsLoading(false);
      } else if (data.status === "processing" && data.videoId) {
        // Video is processing - start polling
        setVideoId(data.videoId);
        setIsLoading(false);
        setIsPolling(true);
        toast({
          title: t('videoGenerationStarted'),
          description: t('videoGenerationStartedDesc'),
        });
        
        // Start polling for status
        pollVideoStatus(data.videoId);
      } else {
        // Unknown status - redirect to profile
        toast({
          title: t('videoGenerationStarted'),
          description: t('checkProfile'),
        });
        router.push("/profile");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('generationFailedDesc');
      setError(errorMessage);
      toast({
        title: t('generationFailed'),
        description: errorMessage,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const pollVideoStatus = async (id: string, maxAttempts = 60) => {
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setIsPolling(false);
        toast({
          title: t('generationTimeout'),
          description: t('generationTimeoutDesc'),
          variant: "destructive",
        });
        router.push("/profile");
        return;
      }

      try {
        const response = await fetch(`/api/video/status?videoId=${id}`);
        const data = await response.json();

        if (data.status === "completed" && data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setIsPolling(false);
          toast({
            title: t('videoGenerated'),
            description: t('videoGeneratedDesc'),
          });
        } else if (data.status === "failed") {
          setIsPolling(false);
          setError(t('generationFailedTryAgain'));
          toast({
            title: t('generationFailed'),
            description: t('generationFailedTryAgain'),
            variant: "destructive",
          });
        } else {
          // Still processing - poll again after 3 seconds
          attempts++;
          setTimeout(poll, 3000);
        }
      } catch (error) {
        console.error("Error polling video status:", error);
        attempts++;
        setTimeout(poll, 3000);
      }
    };

    // Start polling after initial delay
    setTimeout(poll, 3000);
  };

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt">{t('prompt')}</Label>
                {predefinedPrompts.length > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {t('tryTemplate')}
                  </span>
                )}
              </div>
              
              {predefinedPrompts.length > 0 && (
                <Select
                  value={selectedPredefinedPrompt}
                  onValueChange={handlePredefinedPromptChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('chooseTemplate')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">{t('writeOwnPrompt')}</SelectItem>
                    {predefinedPrompts.map((predefined) => (
                      <SelectItem key={predefined.id} value={predefined.id}>
                        {predefined.title}
                        {predefined.description && ` - ${predefined.description}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Textarea
                id="prompt"
                placeholder={
                  predefinedPrompts.length > 0
                    ? t('promptPlaceholder')
                    : t('promptPlaceholderSimple')
                }
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  // If user starts typing, switch to custom mode
                  if (selectedPredefinedPrompt && selectedPredefinedPrompt !== "custom") {
                    setSelectedPredefinedPrompt("custom");
                  }
                }}
                required
                rows={4}
                className="resize-none min-h-[120px] md:min-h-[100px]"
              />
              {selectedPredefinedPrompt && selectedPredefinedPrompt !== "custom" && (
                <p className="text-xs text-muted-foreground">
                  {t('templateSelected')}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="image">{t('referenceImage')}</Label>
              <div className="flex flex-col gap-4">
                {imagePreview ? (
                  <div className="relative w-full max-w-sm">
                    <img
                      src={imagePreview || "/placeholder.svg"}
                      alt="Preview"
                      className="rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <Label
                      htmlFor="image"
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-6 py-8 hover:border-solid"
                    >
                      <Upload className="h-5 w-5" />
                      <span className="text-sm">{t('uploadImage')}</span>
                    </Label>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="duration">{t('duration')}</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 {t('second')}</SelectItem>
                    <SelectItem value="8">8 {t('seconds')}</SelectItem>
                    <SelectItem value="12" defaultValue="12">12 {t('seconds')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('durationNote')}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="model">{t('model')}</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sora-2">Sora 2 ({getCreditCost("sora-2")} credit)</SelectItem>
                    <SelectItem value="sora-2-pro">Sora 2 Pro ({getCreditCost("sora-2-pro")} credits)</SelectItem>
                    {/* <SelectItem value="sora-2-pro-HD">Sora 2 Pro HD ({getCreditCost("sora-2-pro-HD")} credits)</SelectItem> */}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('creditsPerVideo', { count: creditCost, plural: creditCost > 1 ? 's' : '' })}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="dimensions">{t('dimensions')}</Label>
                <Select 
                  value={dimensions} 
                  onValueChange={setDimensions}
                  disabled={!!originalImageFile || !!imageFile}
                >
                  <SelectTrigger id="dimensions">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1280x720">{t('landscape')}</SelectItem>
                    <SelectItem value="720x1280">{t('portrait')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {(originalImageFile || imageFile)
                    ? t('dimensionsLocked')
                    : t('dimensionsNote')}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="sound-effect">{t('soundEffect')}</Label>
                <Select disabled value={soundEffect} onValueChange={setSoundEffect}>
                  <SelectTrigger id="sound-effect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">{t('yes')}</SelectItem>
                    <SelectItem value="no">{t('no')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('soundEffectNote')}
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-medium">{t('generationFailed')}</p>
                <p className="mt-1">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={isLoading || isPolling || userCredits < creditCost} className="w-full">
              {isLoading || isPolling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLoading ? t('submitting') : t('generatingVideo')}
                </>
              ) : (
                t('generateVideo', { cost: creditCost, plural: creditCost > 1 ? 's' : '' })
              )}
            </Button>

            {(isLoading || isPolling) && (
              <p className="text-center text-sm text-muted-foreground">
                {isLoading 
                  ? t('submittingRequest')
                  : t('generationInProgress')}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Image Cropper Dialog */}
      {originalImagePreview && originalImageFile && imageDimensions && (
        <ImageCropper
          imageSrc={originalImagePreview}
          imageFile={originalImageFile}
          isOpen={isCropperOpen}
          onClose={handleCropperClose}
          onCropComplete={handleCropComplete}
          imageDimensions={imageDimensions}
          isLandscape={isLandscape(imageDimensions)}
          targetDimensions={dimensions}
        />
      )}

      {videoUrl && (
        <Card>
          <CardHeader>
            <CardTitle>{t('generatedVideo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg"
            >
              {t('videoNotSupported')}
            </video>
            <Button asChild className="mt-4 w-full" variant="outline">
              <a href={videoUrl} download>
                {t('downloadVideo')}
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
