import { createClient } from "@/lib/supabase/server";
import { ensureUserExists } from "@/app/actions/user";
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

export default async function ProfilePage() {
  const supabase = await createClient();

  // Middleware already protects this route
  const { data: authData } = await supabase.auth.getUser();
  
  if (!authData?.user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Authentication Error</h1>
          <p className="text-muted-foreground mt-2">Please try logging in again.</p>
        </div>
      </div>
    );
  }

  let { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  // Auto-create user if doesn't exist (fallback if trigger didn't fire)
  if (!userData) {
    const result = await ensureUserExists(
      authData.user.id,
      authData.user.email || ""
    );

    if (!result.success || !result.user) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold">Account Setup Error</h1>
            <p className="text-muted-foreground mt-2">
              Failed to create your account. Please check:
            </p>
            <ul className="text-sm text-muted-foreground mt-4 text-left list-disc list-inside space-y-2">
              <li>Run SQL script: <code className="bg-muted px-2 py-1 rounded text-xs">scripts/002_create_user_trigger.sql</code></li>
              <li>Verify SUPABASE_SERVICE_ROLE_KEY is set in .env.dev</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-4">
              Error: {result.error || "Unknown error"}
            </p>
          </div>
        </div>
      );
    }
    
    userData = result.user;
  }

  const { data: videoHistory } = await supabase
    .from("video_history")
    .select("*")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false });

  const user: User = userData;
  const videos: VideoHistory[] = videoHistory || [];

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
