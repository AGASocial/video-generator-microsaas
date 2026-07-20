"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function SignUpSuccessPage() {
  const t = useTranslations("auth");

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 relative">
      <div className="absolute top-6 right-6">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("checkEmail")}</CardTitle>
            <CardDescription>{t("signUpSuccess")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {t("signUpSuccessCheckEmail")}
            </p>
            <Button asChild>
              <Link href="/auth/login">{t("signIn")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
