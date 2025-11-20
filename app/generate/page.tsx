import { Navigation } from "@/components/navigation";
import { VideoGeneratorForm } from "@/components/video-generator-form";
import { createClient } from "@/lib/supabase/server";
import { User } from "@/lib/types";

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
    if (!userData) {
      try {
        // Use service role to bypass RLS for user creation
        const { createClient: createServiceClient } = await import("@supabase/supabase-js");
        
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
        }
        
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
            credits: 10, // Default credits for new users
          })
          .select()
          .single();

        if (createError || !newUser) {
          console.error("[v0] Failed to create user:", createError);
          return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
              <div className="text-center max-w-md bg-card border rounded-lg p-6">
                <h1 className="text-2xl font-bold">Account Setup Error</h1>
                <p className="text-muted-foreground mt-2">
                  Failed to create your account. Please check:
                </p>
                <ul className="text-sm text-muted-foreground mt-4 text-left list-disc list-inside space-y-2">
                  <li>Run SQL script: <code className="bg-muted px-2 py-1 rounded text-xs">scripts/005_add_users_insert_policy.sql</code></li>
                  <li>Verify SUPABASE_SERVICE_ROLE_KEY is set in .env.dev</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-4 break-all">
                  Error: {createError?.message || "Unknown error"}
                </p>
              </div>
            </div>
          );
        }

        userData = newUser;
      } catch (importError) {
        console.error("[v0] Import or service client error:", importError);
        return (
          <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="text-center max-w-md bg-card border rounded-lg p-6">
              <h1 className="text-2xl font-bold">Setup Error</h1>
              <p className="text-muted-foreground mt-2">
                Failed to initialize user creation service.
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                {importError instanceof Error ? importError.message : "Unknown error"}
              </p>
            </div>
          </div>
        );
      }
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

    return (
      <div className="min-h-screen bg-background">
        <Navigation user={user} />
        <main className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-3xl">
            <VideoGeneratorForm userCredits={user.credits} />
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
