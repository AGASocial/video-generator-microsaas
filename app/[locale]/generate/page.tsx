import { Navigation } from "@/components/navigation";
import { VideoGeneratorForm } from "@/components/video-generator-form";
import { VideoList } from "@/components/video-list";
import { getCurrentUser, getRecentVideos } from "@/lib/api-client";
import { User, VideoHistory } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTranslations } from 'next-intl/server';
import { redirect } from "next/navigation";

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic';

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('generate');
  
  // Check authentication first (before try-catch to avoid catching redirect errors)
  const userResult = await getCurrentUser();
  
  if (!userResult.success || !userResult.user) {
    // Redirect to login page with redirect parameter
    redirect(`/${locale}/auth/login?redirect=/${locale}/generate`);
  }

  const user: User = userResult.user;

  try {
    // Fetch recently completed or queued videos from API
    const videosResult = await getRecentVideos(6);
    const recentVideos: VideoHistory[] = videosResult.videos || [];

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
                  <CardTitle>{t('yourRecentCreations')}</CardTitle>
                  <CardDescription>
                    {t('yourRecentCreationsDesc')}
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
          <h1 className="text-2xl font-bold">{t('unexpectedError')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('unexpectedErrorDesc')}
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            {error instanceof Error ? error.message : t('unknownError')}
          </p>
        </div>
      </div>
    );
  }
}

