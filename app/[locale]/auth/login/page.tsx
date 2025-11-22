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
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from 'next-intl';

function LoginForm() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sign in");
      }

      const redirect = searchParams.get("redirect") || "/generate";
      router.push(redirect);
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sign in";
      // Normalize error messages for better UX
      let displayError = errorMessage;
      if (errorMessage.includes("Invalid login credentials") || 
          errorMessage.includes("Invalid email or password") ||
          errorMessage.toLowerCase().includes("invalid")) {
        displayError = t('invalidCredentials');
      }
      setError(displayError);
      toast({
        title: t('signInFailed'),
        description: displayError,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('signIn')}</CardTitle>
            <CardDescription>
              {t('signInDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null); // Clear error when user starts typing
                    }}
                    className={error ? "border-destructive" : ""}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null); // Clear error when user starts typing
                    }}
                    className={error ? "border-destructive" : ""}
                  />
                </div>
                {error && (
                  <Alert variant="destructive" role="alert" className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <AlertDescription className="flex-1">
                      {error.includes("Invalid login credentials") || error.includes("Invalid") 
                        ? t('invalidCredentials')
                        : error}
                    </AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t('signingIn') : t('signInButton')}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                {t('dontHaveAccount')}{" "}
                <Link
                  href="/auth/sign-up"
                  className="underline underline-offset-4"
                >
                  {t('signUp')}
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen w-full items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Sign in</CardTitle>
              <CardDescription>
                Enter your credentials to access your account
              </CardDescription>
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
    }>
      <LoginForm />
    </Suspense>
  );
}
