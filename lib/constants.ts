export const CREDIT_COST_PER_GENERATION = 1;

export const MINIMUM_CREDITS_TO_GENERATE = 1;

export const PLANS = {
  free: {
    label: "Free",
    credits: 10,
    price: 0,
  },
  starter: {
    label: "Starter",
    credits: 50,
    price: 9,
  },
  pro: {
    label: "Pro",
    credits: 100,
    price: 29,
  },
} as const;

export const PRICING_PLANS = [
  {
    key: "free",
    label: "Free",
    description: "Start building. No credit card required.",
    planId: null,
    price: 0,
    active: true,
    featured: false,
    features: ["10 generations / month", "Live preview", "Export to zip"],
  },
  {
    key: "starter",
    label: "Starter",
    description: "For developers who build regularly.",
    planId: "cplan_3JaiYDUz2uP6ROVQ55bexIntuzj",
    price: 9,
    active: false,
    featured: true,
    features: [
      "50 generations / month",
      "Live preview",
      "Image uploads",
      "Export to zip",
    ],
  },
  {
    key: "pro",
    label: "Pro",
    description: "For power users who ship fast.",
    planId: "cplan_3JaigOiOD2KlvtxOK0HBfM5GcLH",
    price: 29,
    active: false,
    featured: false,
    features: [
      "100 generations / month",
      "Priority AI (faster response)",
      "Access to Forge Pro Agent",
      "Live preview",
      "Image uploads",
      "Export to zip",
    ],
  },
] as const;
