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
import { getTranslations } from 'next-intl/server';

export default async function CreditsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('credits');
  
  // Fetch user data from API (optional - page is public)
  const userResult = await getCurrentUser();
  const user: User | null = userResult.success && userResult.user ? userResult.user : null;

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
            <h1 className="text-3xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('description')}
            </p>
          </div>

          {/* User Balance - Only show if authenticated */}
          {user && (
            <Card>
              <CardHeader>
                <CardTitle>{t('yourBalance')}</CardTitle>
                <CardDescription>{t('yourBalanceDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold" data-credits={user.credits}>
                  {t('credits', { count: user.credits })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing - Always visible */}
          <div>
            <h2 className="mb-6 text-2xl font-semibold">{t('purchaseCredits')}</h2>
            <CreditPackages />
          </div>

          {/* Transaction History - Only show if authenticated and has transactions */}
          {user && recentTransactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('transactionHistory')}</CardTitle>
                <CardDescription>{t('transactionHistoryDesc')}</CardDescription>
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
