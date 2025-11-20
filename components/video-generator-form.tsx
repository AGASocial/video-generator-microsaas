"use client";

import { useState, useMemo } from "react";
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
import { Loader2, Upload, X } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getCreditCost } from "@/lib/products";
import { Switch, SwitchThumb } from "@radix-ui/react-switch";

interface VideoGeneratorFormProps {
  userCredits: number;
}

export function VideoGeneratorForm({ userCredits }: VideoGeneratorFormProps) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("8"); // Only 8 seconds for now
  const [model, setModel] = useState("sora-2");
  const [dimensions, setDimensions] = useState("1280x720");
  const [soundEffect, setSoundEffect] = useState("no");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // Calculate credit cost based on selected model
  const creditCost = useMemo(() => getCreditCost(model), [model]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setVideoUrl(null);

    if (userCredits < creditCost) {
      setError(`Insufficient credits. This model requires ${creditCost} credit${creditCost > 1 ? 's' : ''}. Please purchase more credits.`);
      toast({
        title: "Insufficient credits",
        description: `This model requires ${creditCost} credit${creditCost > 1 ? 's' : ''}. You have ${userCredits}.`,
        variant: "destructive",
      });
      router.push("/credits");
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("duration", duration);
      formData.append("model", model);
      formData.append("size", dimensions);
      if (imageFile) {
        formData.append("image", imageFile);
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
          title: "Video generated successfully",
          description: "Your video is ready to view and download.",
        });
        setIsLoading(false);
      } else if (data.status === "processing" && data.videoId) {
        // Video is processing - start polling
        setVideoId(data.videoId);
        setIsLoading(false);
        setIsPolling(true);
        toast({
          title: "Video generation started",
          description: "Your video is being generated. This may take a few moments.",
        });
        
        // Start polling for status
        pollVideoStatus(data.videoId);
      } else {
        // Unknown status - redirect to profile
        toast({
          title: "Video generation started",
          description: "Check your profile page for updates.",
        });
        router.push("/profile");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast({
        title: "Generation failed",
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
          title: "Generation timeout",
          description: "Video generation is taking longer than expected. Check your profile page.",
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
            title: "Video generated successfully",
            description: "Your video is ready to view and download.",
          });
        } else if (data.status === "failed") {
          setIsPolling(false);
          setError("Video generation failed. Please try again.");
          toast({
            title: "Generation failed",
            description: "The video generation failed. Please try again.",
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
          <CardTitle>Generate AI Video</CardTitle>
          <CardDescription>
            Create stunning videos from text prompts and images
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                placeholder="Describe the video you want to generate..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="image">Reference Image (Optional)</Label>
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
                      <span className="text-sm">Upload an image</span>
                    </Label>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="duration">Duration</Label>
                <Select value={duration} onValueChange={setDuration} disabled>
                  <SelectTrigger id="duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8">8 seconds</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Currently only 8-second videos are available
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="model">Model</Label>
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
                  {creditCost === 1 ? "1 credit" : `${creditCost} credits`} per 8-second video
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="dimensions">Dimensions</Label>
                <Select value={dimensions} onValueChange={setDimensions}>
                  <SelectTrigger id="dimensions">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1280x720">Landscape</SelectItem>
                    <SelectItem value="720x1280">Portrait</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="sound-effect">Sound Effect</Label>
                <Select disabled value={soundEffect} onValueChange={setSoundEffect}>
                  <SelectTrigger id="sound-effect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-medium">Generation failed</p>
                <p className="mt-1">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={isLoading || isPolling || userCredits < creditCost} className="w-full">
              {isLoading || isPolling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLoading ? "Submitting..." : "Generating video..."}
                </>
              ) : (
                `Generate Video (${creditCost} credit${creditCost > 1 ? 's' : ''})`
              )}
            </Button>

            {(isLoading || isPolling) && (
              <p className="text-center text-sm text-muted-foreground">
                {isLoading 
                  ? "Submitting your request..." 
                  : "Video generation in progress. This may take up to 45 seconds. Please wait..."}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {videoUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Video</CardTitle>
          </CardHeader>
          <CardContent>
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg"
            >
              Your browser does not support the video tag.
            </video>
            <Button asChild className="mt-4 w-full" variant="outline">
              <a href={videoUrl} download>
                Download Video
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
