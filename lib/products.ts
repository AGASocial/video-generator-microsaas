export interface CreditPackage {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
  credits: number;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter-pack",
    name: "Starter Pack",
    description: "Perfect for trying out the platform",
    priceInCents: 1199, // $11.99
    credits: 6, // ~6 sora-2 videos or 2 sora-2-pro videos
  },
  {
    id: "creator-pack",
    name: "Creator Pack",
    description: "Best value for regular creators",
    priceInCents: 2399, // $23.99
    credits: 13, // ~13 sora-2 videos or 4 sora-2-pro videos
  },
  {
    id: "pro-pack",
    name: "Pro Pack",
    description: "For professional content creators",
    priceInCents: 4799, // $47.99
    credits: 30, // ~30 sora-2 videos or 10 sora-2-pro videos
  },
  {
    id: "enterprise-pack",
    name: "Enterprise Pack",
    description: "Maximum value for power users",
    priceInCents: 11199, // $111.99
    credits: 80, // ~80 sora-2 videos or 26 sora-2-pro videos
  },
];

// Credit costs per model (per D-01: same costs as Sora — repricing deferred to post-Phase 1)
// Model names must match Kling's model_name enum exactly (confirmed via
// https://kling.ai/document-api/api/video/1-6/image-to-video — "kling-v2" is
// NOT a valid value, the real v2 identifier is "kling-v2-master").
export const CREDIT_COSTS = {
  "kling-v1": 1,        // Standard tier — was "sora-2"
  "kling-v1-5": 3,      // Pro tier — was "sora-2-pro"
  "kling-v1-6": 3,      // Same Kling per-second rate as v1-5; adds multi-image-to-video support
  "kling-v2-master": 3, // Pro HD tier — was "sora-2-pro-HD" (fixed invalid "kling-v2" model name)
} as const;

export function getCreditCost(model: string): number {
  return CREDIT_COSTS[model as keyof typeof CREDIT_COSTS] || 1;
}
