import PricingClient from "./PricingClient";
import { isFreeTestMode } from "@/lib/free-test";

export default function PricingPage() {
  const freeTestMode = isFreeTestMode();
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const configuredPlans = {
    essentiel: freeTestMode || (stripeConfigured && Boolean(process.env.STRIPE_PRICE_ESSENTIEL?.trim())),
    pro: freeTestMode || (stripeConfigured && Boolean(process.env.STRIPE_PRICE_PRO?.trim())),
    equipe: freeTestMode || (stripeConfigured && Boolean(process.env.STRIPE_PRICE_EQUIPE?.trim())),
    concierge: freeTestMode || (stripeConfigured && Boolean(process.env.STRIPE_PRICE_CONCIERGE?.trim())),
  };
  return <PricingClient configuredPlans={configuredPlans} />;
}
