import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

export const PLANS = {
  essentiel: {
    name: "Essentiel",
    priceId: process.env.STRIPE_PRICE_ESSENTIEL,
    features: ["personalized_feed", "email_alerts", "site_intelligence_summary"],
  },
  pro: {
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO,
    features: ["full_site_intelligence", "compliance_vault", "exports", "sms_alerts"],
  },
  equipe: {
    name: "Equipe",
    priceId: process.env.STRIPE_PRICE_EQUIPE,
    features: ["pro_features", "five_seats", "api_keys", "webhooks"],
  },
  concierge: {
    name: "Concierge",
    priceId: process.env.STRIPE_PRICE_CONCIERGE,
    oneTime: true,
    features: ["analyst_review", "qualified_opportunity_delivery", "workspace_delivery"],
  },
} as const;
