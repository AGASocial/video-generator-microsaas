"use client";

import Link from "next/link";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { User } from "@/lib/types";

interface NavigationProps {
  user: User | null;
}

export function Navigation({ user }: NavigationProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const response = await fetch("/api/auth/signout", {
        method: "POST",
      });

      if (response.ok) {
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      console.error("Sign out error:", error);
      // Still redirect even if API call fails
      router.push("/");
      router.refresh();
    }
  };

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-semibold">
          Sora Video Generator
        </Link>
        <div className="flex items-center gap-6">
          {user ? (
            <>
              <Link
                href="/generate"
                className="text-sm font-medium hover:underline"
              >
                Generate
              </Link>
              <Link
                href="/credits"
                className="text-sm font-medium hover:underline"
              >
                Credits ({user.credits})
              </Link>
              <Link
                href="/profile"
                className="text-sm font-medium hover:underline"
              >
                Profile
              </Link>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="outline" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button size="sm">Sign up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
