"use client";

import { useState, useMemo } from "react";
import { VideoHistory } from "@/lib/types";
import { VideoList } from "@/components/video-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface VideoHistoryFiltersProps {
  videos: VideoHistory[];
}

type StatusFilter = "all" | "completed" | "processing" | "failed";

export function VideoHistoryFilters({ videos }: VideoHistoryFiltersProps) {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");

  const filteredVideos = useMemo(() => {
    if (activeFilter === "all") {
      return videos;
    }
    return videos.filter((video) => video.status === activeFilter);
  }, [videos, activeFilter]);

  const counts = useMemo(() => {
    return {
      all: videos.length,
      completed: videos.filter((v) => v.status === "completed").length,
      processing: videos.filter((v) => v.status === "processing").length,
      failed: videos.filter((v) => v.status === "failed").length,
    };
  }, [videos]);

  if (videos.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No videos generated yet. Start creating your first video!
      </div>
    );
  }

  return (
    <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as StatusFilter)} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="all" className="flex items-center gap-2">
          All
          <Badge variant="secondary" className="ml-1">
            {counts.all}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="completed" className="flex items-center gap-2">
          Completed
          <Badge variant="secondary" className="ml-1">
            {counts.completed}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="processing" className="flex items-center gap-2">
          Processing
          <Badge variant="secondary" className="ml-1">
            {counts.processing}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="failed" className="flex items-center gap-2">
          Failed
          <Badge variant="secondary" className="ml-1">
            {counts.failed}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-6">
        <VideoList videos={filteredVideos} showEmptyMessage={false} />
      </TabsContent>

      <TabsContent value="completed" className="mt-6">
        <VideoList 
          videos={filteredVideos} 
          showEmptyMessage={true}
          emptyMessage="No completed videos yet"
        />
      </TabsContent>

      <TabsContent value="processing" className="mt-6">
        <VideoList 
          videos={filteredVideos} 
          showEmptyMessage={true}
          emptyMessage="No videos currently processing"
        />
      </TabsContent>

      <TabsContent value="failed" className="mt-6">
        <VideoList 
          videos={filteredVideos} 
          showEmptyMessage={true}
          emptyMessage="No failed videos"
        />
      </TabsContent>
    </Tabs>
  );
}

