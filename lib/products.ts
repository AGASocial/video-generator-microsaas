export interface CreditPackage {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
  credits: number;
  stripePaymentLinkUrl?: string; // Stripe Payment Link URL
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter-pack",
    name: "Starter Pack",
    description: "Perfect for trying out the platform",
    priceInCents: 999, // $9.99
    credits: 6, // ~6 sora-2 videos or 2 sora-2-pro videos
    stripePaymentLinkUrl: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER || "https://buy.stripe.com/aFa4gz2kPfYaeq29li8ww06",
  },
  {
    id: "creator-pack",
    name: "Creator Pack",
    description: "Best value for regular creators",
    priceInCents: 1999, // $19.99
    credits: 12, // ~12 sora-2 videos or 4 sora-2-pro videos
    stripePaymentLinkUrl: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_CREATOR || "https://buy.stripe.com/bJe9AT4sX27ka9M9li8ww07",
  },
  {
    id: "pro-pack",
    name: "Pro Pack",
    description: "For professional content creators",
    priceInCents: 3999, // $39.99
    credits: 25, // ~25 sora-2 videos or 8 sora-2-pro videos
    stripePaymentLinkUrl: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO || "https://buy.stripe.com/9B67sL1gL5jwdlY8he8ww08",
  },
  {
    id: "enterprise-pack",
    name: "Enterprise Pack",
    description: "Maximum value for power users",
    priceInCents: 9999, // $99.99
    credits: 62, // ~62 sora-2 videos or 20 sora-2-pro videos
    stripePaymentLinkUrl: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ENTERPRISE || "https://buy.stripe.com/5kQaEXbVpfYa3Lo1SQ8ww09",
  },
];

// Credit costs per model (8-second videos)
export const CREDIT_COSTS = {
  "sora-2": 1, // $1.60 per video
  "sora-2-pro": 3, // $4.80 per video
  "sora-2-pro-HD": 3, // Same as pro for now
} as const;

export function getCreditCost(model: string): number {
  return CREDIT_COSTS[model as keyof typeof CREDIT_COSTS] || 1;
}
