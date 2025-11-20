import { Navigation } from "@/components/navigation";
import { VideoGeneratorForm } from "@/components/video-generator-form";
import { VideoList } from "@/components/video-list";
import { createClient } from "@/lib/supabase/server";
import { ensureUserExists } from "@/app/actions/user";
import { User, VideoHistory } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function GeneratePage() {
  try {
    const supabase = await createClient();

    // Middleware already protects this route, so user should be authenticated
    const { data: authData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authData?.user) {
      console.error("[v0] Auth error:", authError);
      // If somehow user is not authenticated (shouldn't happen due to middleware)
      // Return error instead of redirecting to prevent loops
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold">Authentication Error</h1>
            <p className="text-muted-foreground mt-2">Please try logging in again.</p>
            {authError && (
              <p className="text-xs text-muted-foreground mt-4">
                {authError.message}
              </p>
            )}
          </div>
        </div>
      );
    }

    let { data: userData, error: userQueryError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    // If user doesn't exist in database, create it automatically
    // This is a fallback if the database trigger didn't fire
    if (!userData) {
      const result = await ensureUserExists(
        authData.user.id,
        authData.user.email || ""
      );

      if (!result.success || !result.user) {
        return (
          <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="text-center max-w-md bg-card border rounded-lg p-6">
              <h1 className="text-2xl font-bold">Account Setup Error</h1>
              <p className="text-muted-foreground mt-2">
                Failed to create your account. Please check:
              </p>
              <ul className="text-sm text-muted-foreground mt-4 text-left list-disc list-inside space-y-2">
                <li>Run SQL script: <code className="bg-muted px-2 py-1 rounded text-xs">scripts/002_create_user_trigger.sql</code></li>
                <li>Verify SUPABASE_SERVICE_ROLE_KEY is set in .env.dev</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4 break-all">
                Error: {result.error || "Unknown error"}
              </p>
            </div>
          </div>
        );
      }

      userData = result.user;
    }

    if (!userData) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-center max-w-md bg-card border rounded-lg p-6">
            <h1 className="text-2xl font-bold">User Not Found</h1>
            <p className="text-muted-foreground mt-2">
              Unable to load your user profile. Please try refreshing.
            </p>
            {userQueryError && (
              <p className="text-xs text-muted-foreground mt-4">
                {userQueryError.message}
              </p>
            )}
          </div>
        </div>
      );
    }

    const user: User = userData;

    // Fetch recently completed or queued videos (last 6) for inspiration
    const { data: completedVideos } = await supabase
      .from("video_history")
      .select("*")
      .eq("user_id", authData.user.id)
      .in("status", ["completed", "queued"])
      .order("created_at", { ascending: false })
      .limit(6);

    const recentVideos: VideoHistory[] = completedVideos || [];

    return (
      <div className="min-h-screen bg-background">
        <Navigation user={user} />
        <main className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-6xl space-y-8">
            {/* Video Generator Form */}
            <div className="max-w-3xl min-w-full">
              <VideoGeneratorForm userCredits={user.credits} />
            </div>

            {/* Recent Completed Videos */}
            {recentVideos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Recent Creations</CardTitle>
                  <CardDescription>
                    Your latest completed videos. Get inspired and create more!
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <VideoList 
                    videos={recentVideos} 
                    showEmptyMessage={false}
                    maxVideos={6}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    );
  } catch (error) {
    console.error("[v0] Generate page error:", error);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-card border rounded-lg p-6">
          <h1 className="text-2xl font-bold">Unexpected Error</h1>
          <p className="text-muted-foreground mt-2">
            Something went wrong. Please try refreshing the page.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }
}
