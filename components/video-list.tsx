"use client";

import { VideoHistory } from "@/lib/types";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, XCircle } from 'lucide-react';
import { useState } from 'react';

interface VideoListProps {
  videos: VideoHistory[];
  showEmptyMessage?: boolean;
  emptyMessage?: string;
  maxVideos?: number;
  className?: string;
}

export function VideoList({ 
  videos, 
  showEmptyMessage = true,
  emptyMessage = "No videos yet",
  maxVideos,
  className = ""
}: VideoListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Limit videos if maxVideos is specified
  const displayVideos = maxVideos ? videos.slice(0, maxVideos) : videos;

  const handleDownload = async (videoUrl: string, videoId: string, prompt: string) => {
    try {
      setDownloadingId(videoId);
      
      // Fetch the video as a blob
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error('Failed to download video');
      }
      
      const blob = await response.blob();
      
      // Create a blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      // Generate a filename from the prompt (sanitized) or use video ID
      const sanitizedPrompt = prompt
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()
        .substring(0, 50);
      const filename = `${sanitizedPrompt || 'video'}_${videoId.substring(0, 8)}.mp4`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download video. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (displayVideos.length === 0 && showEmptyMessage) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {displayVideos.map((video) => (
        <Card key={video.id} className="overflow-hidden">
          <div className="aspect-video bg-muted relative">
            {video.video_url ? (
              <video
                src={video.video_url}
                className="h-full w-full object-cover"
                controls
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                {video.status === "processing" ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <Badge variant="secondary">Processing</Badge>
                  </div>
                ) : video.status === "failed" ? (
                  <div className="flex flex-col items-center gap-2">
                    <XCircle className="h-8 w-8 text-destructive" />
                    <Badge variant="destructive">Failed</Badge>
                  </div>
                ) : (
                  <Badge variant="secondary">{video.status}</Badge>
                )}
              </div>
            )}
          </div>
          <CardContent className="p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-sm font-medium">
                {video.prompt}
              </p>
              <Badge variant="outline" className="shrink-0">
                {video.duration}s
              </Badge>
            </div>
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{video.model}</span>
              <span>•</span>
              <span>
                {new Date(video.created_at).toLocaleDateString()}
              </span>
            </div>
            {video.video_url && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleDownload(video.video_url!, video.id, video.prompt)}
                disabled={downloadingId === video.id}
              >
                {downloadingId === video.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

