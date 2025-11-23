import { getCurrentUser, getUserTransactions } from "@/lib/api-client";
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
import { redirect } from 'next/navigation';
import { routing } from "@/i18n/routing";

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic';

export default async function CreditsPage() {
  // Fetch user data from API - require authentication
  const userResult = await getCurrentUser();
  
  if (!userResult.success || !userResult.user) {
    // Redirect to login page with redirect parameter
    const defaultLocale = routing.defaultLocale;
    redirect(`/${defaultLocale}/auth/login?redirect=/credits`);
  }
  
  const user: User = userResult.user;

  // Fetch transactions from API only if user is authenticated
  let recentTransactions: Transaction[] = [];
  if (user) {
    const transactionsResult = await getUserTransactions({ limit: 10 });
    recentTransactions = transactionsResult.transactions || [];
  }

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

          {/* User Balance - Only show if authenticated */}
          {user && (
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
          )}

          {/* Pricing - Always visible */}
          <div>
            <h2 className="mb-6 text-2xl font-semibold">Purchase Credits</h2>
            <CreditPackages />
          </div>

          {/* Transaction History - Only show if authenticated and has transactions */}
          {user && recentTransactions.length > 0 && (
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
