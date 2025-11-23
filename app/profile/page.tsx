import { getCurrentUser, getUserVideos } from "@/lib/api-client";
import { Navigation } from "@/components/navigation";
import { User, VideoHistory } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VideoList } from "@/components/video-list";
import { VideoHistoryFilters } from "@/components/video-history-filters";
import { ThemeSelector } from "@/components/theme-selector";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  // Fetch user data from API
  const userResult = await getCurrentUser();
  
  if (!userResult.success || !userResult.user) {
    // Redirect to login page with redirect parameter
    const defaultLocale = routing.defaultLocale;
    redirect(`/${defaultLocale}/auth/login?redirect=/profile`);
  }

  const user: User = userResult.user;

  // Fetch video history from API
  const videosResult = await getUserVideos({ 
    order: "created_at", 
    ascending: false 
  });
  const videos: VideoHistory[] = videosResult.videos || [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-6xl space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground">
              Manage your account and view your video history
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Account Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div className="font-medium">{user.email}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Available Credits
                  </div>
                  <div className="text-2xl font-bold">{user.credits}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Member Since
                  </div>
                  <div className="font-medium">
                    {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Total Videos Generated
                  </div>
                  <div className="text-2xl font-bold">{videos.length}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Completed Videos
                  </div>
                  <div className="text-2xl font-bold">
                    {videos.filter((v) => v.status === "completed").length}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Processing
                  </div>
                  <div className="text-2xl font-bold">
                    {videos.filter((v) => v.status === "processing").length}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <ThemeSelector />

          <Card>
            <CardHeader>
              <CardTitle>Video History</CardTitle>
              <CardDescription>
                Complete record of all your generated videos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VideoHistoryFilters videos={videos} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
