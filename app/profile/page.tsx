import { createClient } from "@/lib/supabase/server";
import { Navigation } from "@/components/navigation";
import { User, VideoHistory } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from 'lucide-react';

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

  // Auto-create user if doesn't exist
  if (!userData) {
    // Use service role to bypass RLS for user creation
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    const { data: newUser, error: createError } = await serviceSupabase
      .from("users")
      .insert({
        id: authData.user.id,
        email: authData.user.email || "",
        credits: 10,
      })
      .select()
      .single();

    if (createError || !newUser) {
      console.error("[v0] Failed to create user:", createError);
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold">Account Setup Error</h1>
            <p className="text-muted-foreground mt-2">
              Failed to create your account. Please check:
            </p>
            <ul className="text-sm text-muted-foreground mt-4 text-left list-disc list-inside space-y-2">
              <li>Run SQL script: <code className="bg-muted px-2 py-1 rounded text-xs">scripts/005_add_users_insert_policy.sql</code></li>
              <li>Verify SUPABASE_SERVICE_ROLE_KEY is set in .env.dev</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-4">
              Error: {createError?.message || "Unknown error"}
            </p>
          </div>
        </div>
      );
    }
    
    userData = newUser;
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

          <Card>
            <CardHeader>
              <CardTitle>Video History</CardTitle>
              <CardDescription>
                All your generated videos in one place
              </CardDescription>
            </CardHeader>
            <CardContent>
              {videos.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No videos generated yet. Start creating your first video!
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {videos.map((video) => (
                    <Card key={video.id} className="overflow-hidden">
                      <div className="aspect-video bg-muted">
                        {video.video_url ? (
                          <video
                            src={video.video_url}
                            className="h-full w-full object-cover"
                            controls
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Badge variant="secondary">{video.status}</Badge>
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
                            asChild
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <a href={video.video_url} download>
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </a>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
