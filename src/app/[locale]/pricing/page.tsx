import PricingClient from "./PricingClient";

export default function PricingPage() {
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const configuredPlans = {
    essentiel: stripeConfigured && Boolean(process.env.STRIPE_PRICE_ESSENTIEL?.trim()),
    pro: stripeConfigured && Boolean(process.env.STRIPE_PRICE_PRO?.trim()),
    equipe: stripeConfigured && Boolean(process.env.STRIPE_PRICE_EQUIPE?.trim()),
    concierge: stripeConfigured && Boolean(process.env.STRIPE_PRICE_CONCIERGE?.trim()),
  };
  return <PricingClient configuredPlans={configuredPlans} />;
}
