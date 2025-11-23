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
        // Check for OAuth error parameters first (Google may redirect with error)
        const errorParam = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");
        
        if (errorParam) {
          console.error("OAuth error:", errorParam, errorDescription);
          let errorMessage = "Authentication failed";
          
          // Provide user-friendly error messages
          if (errorParam === "access_denied") {
            errorMessage = "Sign in was canceled. Please try again.";
          } else if (errorParam === "redirect_uri_mismatch") {
            errorMessage = "Configuration error. Please contact support.";
          } else if (errorDescription) {
            errorMessage = errorDescription.replace(/\+/g, " ");
          }
          
          setError(errorMessage);
          setTimeout(() => {
            router.replace(`/${locale}/auth/login?error=${encodeURIComponent(errorParam)}`);
          }, 3000);
          return;
        }

        // Get the code from URL parameters
        const code = searchParams.get("code");
        
        if (code) {
          // Exchange the code for a session using the full URL (Supabase will extract code and code_verifier)
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error("Auth callback error:", exchangeError);
            setError(exchangeError.message);
            setTimeout(() => {
              router.replace(`/${locale}/auth/login?error=callback_error`);
            }, 3000);
            return;
          }

          if (data.session) {
            // Get the redirect destination from sessionStorage (stored before OAuth)
            const redirect = typeof window !== "undefined" 
              ? sessionStorage.getItem("auth_redirect") || `/${locale}/generate`
              : `/${locale}/generate`;
            
            // Clear the stored redirect
            if (typeof window !== "undefined") {
              sessionStorage.removeItem("auth_redirect");
            }
            
            router.push(redirect);
            router.refresh();
          } else {
            setError("No session created");
            setTimeout(() => {
              router.replace(`/${locale}/auth/login?error=no_session`);
            }, 3000);
          }
        } else {
          // Check if there's already a session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (!sessionError && session) {
            // Get the redirect destination from sessionStorage
            const redirect = typeof window !== "undefined" 
              ? sessionStorage.getItem("auth_redirect") || `/${locale}/generate`
              : `/${locale}/generate`;
            
            // Clear the stored redirect
            if (typeof window !== "undefined") {
              sessionStorage.removeItem("auth_redirect");
            }
            
            router.push(redirect);
            router.refresh();
          } else {
            setError("No session found");
            setTimeout(() => {
              router.replace(`/${locale}/auth/login?error=no_session`);
            }, 3000);
          }
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setTimeout(() => {
          router.replace(`/${locale}/auth/login?error=callback_error`);
        }, 3000);
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

