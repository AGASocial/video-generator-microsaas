import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Provide user-friendly error messages
      let errorMessage = "Invalid login credentials";
      
      if (error.message.includes("Invalid login credentials") || 
          error.message.includes("Invalid email or password") ||
          error.message.includes("Email not confirmed")) {
        errorMessage = "Invalid login credentials";
      } else if (error.message.includes("Too many requests")) {
        errorMessage = "Too many login attempts. Please try again later.";
      } else {
        // For other errors, use a generic message for security
        errorMessage = "Invalid login credentials";
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: data.user,
    });
  } catch (error) {
    console.error("[v0] Login API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

