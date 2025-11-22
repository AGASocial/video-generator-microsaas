"use client";

import Link from "next/link";
import { useRouter, usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { User } from "@/lib/types";
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from './language-switcher';

interface NavigationProps {
  user: User | null;
}

export function Navigation({ user }: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('navigation');

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
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between px-4 py-4 gap-4 md:gap-0">
        <Link href="/" className="text-xl font-semibold">
          {t('videoGenerator')}
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <div className="flex items-center gap-6">
            {user ? (
              <>
                <Link
                  href="/generate"
                  className="text-sm font-medium hover:underline"
                >
                  {t('generate')}
                </Link>
                <Link
                  href="/credits"
                  className="text-sm font-medium hover:underline"
                >
                  {t('credits', { count: user.credits })}
                </Link>
                <Link
                  href="/profile"
                  className="text-sm font-medium hover:underline"
                >
                  {t('profile')}
                </Link>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  {t('signOut')}
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="outline" size="sm">
                    {t('signIn')}
                  </Button>
                </Link>
                <Link href="/auth/sign-up">
                  <Button size="sm">{t('signUp')}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
