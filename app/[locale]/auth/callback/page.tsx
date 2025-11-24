"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale, useTranslations } from 'next-intl';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const locale = useLocale();
  const supabase = createClient();

  useEffect(() => {
    async function handleAuth() {
      try {
        // Check for OAuth error parameters first (Google may redirect with error)
        const errorParam = searchParams.get("error");
        
        if (errorParam) {
          console.error("OAuth error:", errorParam);
          router.replace(`/${locale}/auth/login?error=${encodeURIComponent(t('oauthError'))}`);
          return;
        }

        // Supabase JS client with @supabase/ssr will automatically handle the session
        // if the code is present in the URL. The code verifier is stored in cookies
        // by the signInWithOAuth call and retrieved automatically by getSession()
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!error && session) {
          // Get the redirect destination from sessionStorage (stored before OAuth)
          const redirect = typeof window !== "undefined" 
            ? sessionStorage.getItem("auth_redirect") || `/${locale}/generate`
            : `/${locale}/generate`;
          
          // Clear the stored redirect
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("auth_redirect");
          }
          
          router.replace(redirect);
          router.refresh();
        } else {
          // Handle error (show message, redirect, etc.)
          console.error('Auth callback error:', error);
          router.replace(`/${locale}/auth/login?error=callback_error`);
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace(`/${locale}/auth/login?error=callback_error`);
      }
    }

    handleAuth();
  }, [router, searchParams, locale, supabase]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <span>{t('signingIn')}</span>
    </div>
  );
}

