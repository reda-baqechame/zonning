import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const PLANS = {
  essentiel: {
    name: "Essentiel",
    price: 199,
    priceId: process.env.STRIPE_PRICE_ESSENTIEL,
    features: ["chantier_radar_limited", "seao_5_week"],
  },
  pro: {
    name: "Pro",
    price: 349,
    priceId: process.env.STRIPE_PRICE_PRO,
    features: ["chantier_radar_unlimited", "marches_qc_full", "rbq_fit", "compliance_vault"],
  },
  equipe: {
    name: "Équipe",
    price: 699,
    priceId: process.env.STRIPE_PRICE_EQUIPE,
    features: ["pro_features", "5_seats", "api_export"],
  },
  concierge: {
    name: "Concierge",
    price: 2500,
    priceId: process.env.STRIPE_PRICE_CONCIERGE,
    oneTime: true,
  },
} as const;
