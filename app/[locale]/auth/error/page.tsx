"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const tAuth = useTranslations("auth");
  const tGenerate = useTranslations("generate");

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 relative">
      <div className="absolute top-6 right-6">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{tGenerate("authenticationError")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {error ? `${tGenerate("errorLabel")} ${error}` : tGenerate("authenticationErrorDesc")}
            </p>
            <Button asChild>
              <Link href="/auth/login">{tAuth("signIn")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
