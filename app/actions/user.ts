"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * Ensure user exists in the database
 * Creates the user if they don't exist (fallback if trigger didn't fire)
 * This should ideally be handled by the database trigger, but this is a safety net
 */
export async function ensureUserExists(userId: string, email: string) {
  try {
    const supabase = await createClient();
    
    // First, try to get the user with the regular client
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (existingUser) {
      return { success: true, user: existingUser };
    }

    // If user doesn't exist, create it using service role (bypasses RLS)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: newUser, error: createError } = await serviceSupabase
      .from("users")
      .insert({
        id: userId,
        email: email,
        credits: 0, // Default credits for new users
      })
      .select()
      .single();

    if (createError || !newUser) {
      console.error("[v0] Failed to create user:", createError);
      return {
        success: false,
        error: createError?.message || "Failed to create user",
      };
    }

    return { success: true, user: newUser };
  } catch (error) {
    console.error("[v0] Error ensuring user exists:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

