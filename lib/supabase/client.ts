/**
 * @deprecated This browser client should not be used directly in client components.
 * It exposes Supabase URL and keys to the browser, which is a security risk.
 * 
 * Instead, use API routes for all database operations:
 * - GET /api/user/theme - for theme preferences
 * - GET /api/user - for user data
 * - etc.
 * 
 * This file is kept for backward compatibility but should not be imported in new code.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
