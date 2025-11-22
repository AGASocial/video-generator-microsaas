import { createClient } from "@/lib/supabase/server";
import { ensureUserExists } from "@/app/actions/user";
import { Navigation } from "@/components/navigation";
import { CreditPackages } from "@/components/credit-packages";
import { PaymentSuccessHandler } from "@/components/payment-success-handler";
import { User, Transaction } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Suspense } from "react";

export default async function CreditsPage() {
  const supabase = await createClient();

  // Middleware already protects this route
  const { data: authData } = await supabase.auth.getUser();
  
  if (!authData?.user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Authentication Error</h1>
          <p className="text-muted-foreground mt-2">Please try logging in again.</p>
        </div>
      </div>
    );
  }

  let { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  // Auto-create user if doesn't exist (fallback if trigger didn't fire)
  if (!userData) {
    const result = await ensureUserExists(
      authData.user.id,
      authData.user.email || ""
    );

    if (!result.success || !result.user) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold">Account Setup Error</h1>
            <p className="text-muted-foreground mt-2">
              Failed to create your account. Please check:
            </p>
            <ul className="text-sm text-muted-foreground mt-4 text-left list-disc list-inside space-y-2">
              <li>Run SQL script: <code className="bg-muted px-2 py-1 rounded text-xs">scripts/002_create_user_trigger.sql</code></li>
              <li>Verify SUPABASE_SERVICE_ROLE_KEY is set in .env.dev</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-4">
              Error: {result.error || "Unknown error"}
            </p>
          </div>
        </div>
      );
    }
    
    userData = result.user;
  }

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", authData.user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const user: User = userData;
  const recentTransactions: Transaction[] = transactions || [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />
      <Suspense fallback={null}>
        <PaymentSuccessHandler />
      </Suspense>
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-6xl space-y-8">
          <div>
            <h1 className="text-3xl font-bold">Credits</h1>
            <p className="text-muted-foreground">
              Purchase credits to generate more AI videos
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Your Balance</CardTitle>
              <CardDescription>Current available credits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold" data-credits={user.credits}>
                {user.credits} credits
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-6 text-2xl font-semibold">Purchase Credits</h2>
            <CreditPackages />
          </div>

          {recentTransactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Your recent purchases</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div>
                        <div className="font-medium">
                          {transaction.credits_purchased} credits
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          ${(transaction.amount / 100).toFixed(2)}
                        </div>
                        <div className="text-sm capitalize text-muted-foreground">
                          {transaction.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
