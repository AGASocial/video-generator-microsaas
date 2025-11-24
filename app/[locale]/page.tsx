import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/navigation";
import { getCurrentUser } from "@/lib/api-client";
import { 
  Sparkles, 
  Video, 
  Zap, 
  Wand2, 
  Clock, 
  CheckCircle2,
  Upload,
  Play,
  Image as ImageIcon,
  Gift,
  Laugh,
  MessageCircle
} from 'lucide-react';
import { User } from "@/lib/types";
import { getTranslations } from 'next-intl/server';
import NextImage from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CREDIT_PACKAGES } from "@/lib/products";
import { Badge } from "@/components/ui/badge";

// Force dynamic rendering since we use cookies for authentication (optional)
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const t = await getTranslations();
  let user: User | null = null;

  // Try to get user data if authenticated (home page doesn't require auth)
  const userResult = await getCurrentUser();
  if (userResult.success && userResult.user) {
    user = userResult.user;
  }

  // Static files in public folder are served from root, not under locale
  // So we use relative paths that will resolve correctly

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />
      <main className="container mx-auto px-4">
        {/* Hero Section */}
        <section className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center text-center py-12">
          <div className="mx-auto max-w-4xl space-y-8">
            <div className="space-y-4">
              <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                {t('home.heroTitle')}
              </h1>
              <p className="text-pretty text-xl text-muted-foreground max-w-2xl mx-auto">
                {t('home.heroDescription')}
              </p>
            </div>
            
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>{t('home.heroPoint1')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>{t('home.heroPoint2')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>{t('home.heroPoint3')}</span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row pt-4">
              <Button size="lg" asChild>
                <Link href="/generate">
                  <Upload className="mr-2 h-4 w-4" />
                  {t('home.uploadImage')}
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#examples">
                  <Play className="mr-2 h-4 w-4" />
                  {t('home.viewExamples')}
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                asChild
              >
                <a 
                  href="https://wa.me/16574145114?text=Help%20me%20with%20CCTV%20Magic"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {t('home.contactSupportWhatsApp')}
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* Why People Love CCTV Magic */}
        <section className="py-16 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t('home.whyLoveTitle')}
            </h2>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            <Card>
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{t('home.realisticVideos')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('home.realisticVideosDesc')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                  <Gift className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{t('home.perfectForHolidays')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('home.perfectForHolidaysDesc')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                  <Laugh className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{t('home.surpriseFamily')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('home.surpriseFamilyDesc')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{t('home.easyFastAutomatic')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('home.easyFastAutomaticDesc')}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 bg-muted/50 rounded-lg">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t('home.howItWorksTitle')}
              </h2>
            </div>
            
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                  1
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">{t('home.step1Title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('home.step1Desc')}
                  </p>
                </div>
                <ImageIcon className="h-12 w-12 text-muted-foreground opacity-50" />
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                  2
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">{t('home.step2Title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('home.step2Desc')}
                  </p>
                </div>
                <Wand2 className="h-12 w-12 text-muted-foreground opacity-50" />
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                  3
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">{t('home.step3Title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('home.step3Desc')}
                  </p>
                </div>
                <Sparkles className="h-12 w-12 text-muted-foreground opacity-50" />
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                  4
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">{t('home.step4Title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('home.step4Desc')}
                  </p>
                </div>
                <Clock className="h-12 w-12 text-muted-foreground opacity-50" />
              </div>
            </div>
          </div>
        </section>

        {/* Pricing with Examples Section */}
        <section id="pricing" className="py-16 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t('home.pricingTitle')}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('home.pricingDesc')}
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {CREDIT_PACKAGES.map((pkg) => (
              <Card
                key={pkg.id}
                className={`flex flex-col ${pkg.id === "creator-pack" ? "border-primary border-2" : ""}`}
              >
                <CardHeader>
                  {pkg.id === "creator-pack" && (
                    <Badge className="mb-2 w-fit" variant="default">
                      {t('home.bestValue')}
                    </Badge>
                  )}
                  <CardTitle className="text-xl">{pkg.name}</CardTitle>
                  <CardDescription>{pkg.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 flex-1">
                  <div>
                    <div className="text-3xl font-bold">
                      ${(pkg.priceInCents / 100).toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {pkg.credits} {t('home.perVideo') === 'por video' ? 'créditos' : 'credits'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ${(pkg.priceInCents / 100 / pkg.credits).toFixed(2)} {t('home.perVideo') === 'por video' ? 'por crédito' : 'per credit'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      ~{Math.floor(pkg.credits / 3)} {t('home.perVideo')}
                    </div>
                  </div>
                  <Button asChild className="w-full mt-auto" variant={pkg.id === "creator-pack" ? "default" : "outline"}>
                    <Link href="/credits">
                      {t('home.getStarted')}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Examples with Pricing Context */}
          <div id="examples" className="max-w-6xl mx-auto space-y-8 pt-8">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold tracking-tight">
                {t('home.pricingExamplesTitle')}
              </h3>
              <p className="text-muted-foreground">
                {t('home.pricingExamplesDesc')}
              </p>
            </div>
            
            <div  className="grid gap-12 md:grid-cols-1 lg:grid-cols-2">
              {/* Example 1: Living Room */}
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Family Room</CardTitle>
                  <CardDescription>Christmas magic in your living room</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">{t('home.originalImage')}</h4>
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden border">
                      <NextImage
                        src="/living-room.jpeg"
                        alt="Living room CCTV original"
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">{t('home.aiGeneratedVideo')}</h4>
                    <div className="relative w-full rounded-lg overflow-hidden border bg-black" style={{ aspectRatio: '16/9' }}>
                      <video
                        src="/living-room.mp4"
                        controls
                        playsInline
                        className="w-full h-full"
                        preload="metadata"
                        style={{ display: 'block', width: '100%', height: '100%' }}
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground text-center">
                      {t('home.startingAt')} $2.00 {t('home.perVideo')} • 1 credit
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Example 2: Play Room */}
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Play Room</CardTitle>
                  <CardDescription>Toys coming to life</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">{t('home.originalImage')}</h4>
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden border">
                      <NextImage
                        src="/play-room.jpeg"
                        alt="Play room CCTV original"
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">{t('home.aiGeneratedVideo')}</h4>
                    <div className="relative w-full rounded-lg overflow-hidden border bg-black" style={{ aspectRatio: '16/9' }}>
                      <video
                        src="/play-room.mp4"
                        controls
                        playsInline
                        className="w-full h-full"
                        preload="metadata"
                        style={{ display: 'block', width: '100%', height: '100%' }}
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground text-center">
                      {t('home.startingAt')} $2.00 {t('home.perVideo')} • 1 credit
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

