"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/language-switcher";

function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError(t("resetPassword.passwordMismatch"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      toast({
        title: t("resetPassword.success"),
      });
    } catch (err) {
      console.error("[ResetPassword]", err);
      const errorMessage = t("resetPassword.error");
      setError(errorMessage);
      toast({
        title: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 relative">
      <div className="absolute top-6 right-6">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t("resetPassword.title")}</CardTitle>
            <CardDescription>{t("resetPassword.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <Alert variant="default" role="status">
                <AlertDescription>
                  {t("resetPassword.success")}{" "}
                  <Link href="/auth/login" className="underline underline-offset-4">
                    {t("signIn")}
                  </Link>
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="newPassword">{t("resetPassword.newPassword")}</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      autoFocus
                      required
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      className={error ? "border-destructive border" : "border"}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="confirmPassword">{t("resetPassword.confirmPassword")}</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      className={error ? "border-destructive border" : "border"}
                    />
                  </div>
                  {error && (
                    <Alert variant="destructive" role="alert" className="flex items-start gap-3">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <AlertDescription className="flex-1">{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("resetPassword.updating")}
                      </>
                    ) : (
                      t("resetPassword.submit")
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Reset your password</CardTitle>
                <CardDescription>Enter a new password for your account</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-6">
                  <div className="h-10 w-full animate-pulse bg-muted" />
                  <div className="h-10 w-full animate-pulse bg-muted" />
                  <div className="h-10 w-full animate-pulse bg-muted" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
