import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, Video, Zap } from 'lucide-react';
import { User } from "@/lib/types";

export default async function HomePage() {
  const supabase = await createClient();
  let user: User | null = null;

  const { data: authData } = await supabase.auth.getUser();
  if (authData?.user) {
    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("id", authData.user.id)
      .single();
    
    if (userData) {
      user = userData;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />
      <main className="container mx-auto px-4">
        <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center text-center">
          <div className="mx-auto max-w-3xl space-y-8">
            <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
              Create Stunning AI Videos from Text and Images
            </h1>
            <p className="text-pretty text-xl text-muted-foreground">
              Transform your ideas into professional videos using the power of
              Sora AI. Simple, fast, and creative.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/generate">
                  Start Generating
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/credits">View Pricing</Link>
              </Button>
            </div>

            <div className="grid gap-8 pt-12 sm:grid-cols-3">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">AI Powered</h3>
                <p className="text-sm text-muted-foreground">
                  Powered by OpenAI&apos;s Sora models
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Fast Generation</h3>
                <p className="text-sm text-muted-foreground">
                  Videos ready in under 45 seconds
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Multiple Formats</h3>
                <p className="text-sm text-muted-foreground">
                  Choose duration and quality
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
