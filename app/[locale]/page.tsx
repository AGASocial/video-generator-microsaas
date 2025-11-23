import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/navigation";
import { getCurrentUser } from "@/lib/api-client";
import { Sparkles, Video, Zap } from 'lucide-react';
import { User } from "@/lib/types";
import { getTranslations } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations();
  let user: User | null = null;

  // Try to get user data if authenticated (home page doesn't require auth)
  const userResult = await getCurrentUser();
  if (userResult.success && userResult.user) {
    user = userResult.user;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />
      <main className="container mx-auto px-4">
        <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center text-center">
          <div className="mx-auto max-w-3xl space-y-8">
            <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
              {t('home.title')}
            </h1>
            <p className="text-pretty text-xl text-muted-foreground">
              {t('home.description')}
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/generate">
                  {t('home.startGenerating')}
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/credits">{t('home.viewPricing')}</Link>
              </Button>
            </div>

            <div className="grid gap-8 pt-12 sm:grid-cols-3">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{t('home.aiPowered')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('home.aiPoweredDesc')}
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{t('home.fastGeneration')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('home.fastGenerationDesc')}
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{t('home.multipleFormats')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('home.multipleFormatsDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

