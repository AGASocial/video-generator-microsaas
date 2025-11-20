"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CREDIT_PACKAGES } from "@/lib/products";
import { Check, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

export function CreditPackages() {
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const { toast } = useToast();

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {CREDIT_PACKAGES.map((pkg) => (
          <Card
            key={pkg.id}
            className={pkg.id === "creator-pack" ? "border-primary" : ""}
          >
            <CardHeader>
              {pkg.id === "creator-pack" && (
                <div className="mb-2 inline-flex w-fit rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Best Value
                </div>
              )}
              <CardTitle>{pkg.name}</CardTitle>
              <CardDescription>{pkg.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <div className="text-4xl font-bold">
                  ${(pkg.priceInCents / 100).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {pkg.credits} credits
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  ${(pkg.priceInCents / 100 / pkg.credits).toFixed(2)} per
                  credit
                </div>
              </div>
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>{pkg.credits} video generations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>All models available</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>No expiration</span>
                </li>
              </ul>
              <Button
                onClick={() => handlePurchase(pkg.id)}
                className="w-full"
                variant={pkg.id === "creator-pack" ? "default" : "outline"}
                disabled={loadingPackage !== null || !pkg.stripePaymentLinkUrl}
              >
                {loadingPackage === pkg.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Purchase"
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );

  async function handlePurchase(packageId: string) {
    setLoadingPackage(packageId);

    try {
      const response = await fetch("/api/checkout/payment-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packageId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create payment link");
      }

      // Redirect to Stripe Payment Link with user ID
      window.location.href = data.paymentLinkUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      toast({
        title: "Purchase failed",
        description: errorMessage,
        variant: "destructive",
      });
      setLoadingPackage(null);
    }
  }
}
