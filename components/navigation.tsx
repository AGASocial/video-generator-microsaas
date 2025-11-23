"use client";

import Link from "next/link";
import { useRouter, usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { User } from "@/lib/types";
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from './language-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu } from 'lucide-react';
import { useLocale } from 'next-intl';
import { routing } from '@/i18n/routing';

interface NavigationProps {
  user: User | null;
}

const localeNames: Record<string, string> = {
  es: 'Español',
  en: 'English',
};

export function Navigation({ user }: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
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

  const handleLocaleChange = (newLocale: string) => {
    const pathWithoutLocale = pathname.replace(`/${locale}`, '') || '/';
    const newPath = `/${newLocale}${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`;
    router.push(newPath);
    router.refresh();
  };

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto flex flex-row items-center justify-between px-4 py-4 gap-4">
        <Link href="/" className="text-xl font-semibold">
          {t('videoGenerator')}
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-4">
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

        {/* Mobile Navigation */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild className="md:hidden">
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user ? (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/generate" className="w-full">
                    {t('generate')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/credits" className="w-full">
                    {t('credits', { count: user.credits })}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="w-full">
                    {t('profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Language</DropdownMenuLabel>
                {routing.locales.map((loc) => (
                  <DropdownMenuItem
                    key={loc}
                    onClick={() => handleLocaleChange(loc)}
                    className={locale === loc ? 'bg-accent' : ''}
                  >
                    {localeNames[loc]}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  variant="destructive"
                >
                  {t('signOut')}
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/auth/login" className="w-full">
                    {t('signIn')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/auth/sign-up" className="w-full">
                    {t('signUp')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Language</DropdownMenuLabel>
                {routing.locales.map((loc) => (
                  <DropdownMenuItem
                    key={loc}
                    onClick={() => handleLocaleChange(loc)}
                    className={locale === loc ? 'bg-accent' : ''}
                  >
                    {localeNames[loc]}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
