"use server";

import { stripe } from "@/lib/stripe";
import { CREDIT_PACKAGES } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";

export async function startCheckoutSession(packageId: string) {
  const product = CREDIT_PACKAGES.find((p) => p.id === packageId);
  if (!product) {
    throw new Error(`Package with id "${packageId}" not found`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: product.priceInCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
      packageId: product.id,
      credits: product.credits.toString(),
    },
  });

  return session.client_secret;
}
