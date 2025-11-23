/**
 * Browser Supabase client for OAuth flows and client-side auth operations.
 * 
 * This client is required for:
 * - OAuth flows (signInWithOAuth) - needs PKCE code verifier storage
 * - Auth callbacks (exchangeCodeForSession) - needs PKCE code verifier retrieval
 * 
 * NOTE: For database operations, use API routes instead to avoid exposing keys.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
