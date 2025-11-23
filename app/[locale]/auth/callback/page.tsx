"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('auth');
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleAuth() {
      try {
        // Get the code from URL parameters
        const code = searchParams.get("code");
        
        if (code) {
          // Exchange the code for a session
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error("Auth callback error:", exchangeError);
            setError(exchangeError.message);
            setTimeout(() => {
              router.replace(`/${locale}/auth/login?error=callback_error`);
            }, 2000);
            return;
          }

          if (data.session) {
            // Get the redirect parameter or default to /generate
            const redirect = searchParams.get("redirect") || `/${locale}/generate`;
            router.push(redirect);
            router.refresh();
          }
        } else {
          // Check if there's already a session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (!sessionError && session) {
            const redirect = searchParams.get("redirect") || `/${locale}/generate`;
            router.push(redirect);
            router.refresh();
          } else {
            setError("No session found");
            setTimeout(() => {
              router.replace(`/${locale}/auth/login?error=no_session`);
            }, 2000);
          }
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setTimeout(() => {
          router.replace(`/${locale}/auth/login?error=callback_error`);
        }, 2000);
      }
    }

    handleAuth();
  }, [router, searchParams, supabase, locale]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t('completingSignIn')}</CardTitle>
          <CardDescription>
            {error || t('pleaseWait')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          {error ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <p className="text-xs text-muted-foreground">{t('redirecting')}</p>
            </div>
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

