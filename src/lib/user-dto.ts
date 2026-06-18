/** Safe user shape for client/API responses — omits billing identifiers. */
export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  companyName: string | null;
  rbqLicenseClass: string | null;
  rbqLicenseNumber: string | null;
  rbqVerified: boolean;
  rbqVerifiedAt: Date | null;
  trades: string | null;
  regions: string | null;
  phone: string | null;
  ampAuthorized: boolean;
  minProjectCost: number | null;
  maxProjectCost: number | null;
  plan: string;
  onboardingComplete: boolean;
  alertSmsEnabled: boolean;
  hasStripeCustomer: boolean;
};

export function toPublicUser(user: {
  id: string;
  email: string;
  name: string | null;
  companyName: string | null;
  rbqLicenseClass: string | null;
  rbqLicenseNumber: string | null;
  rbqVerified: boolean;
  rbqVerifiedAt: Date | null;
  trades: string | null;
  regions: string | null;
  phone: string | null;
  ampAuthorized: boolean;
  minProjectCost: number | null;
  maxProjectCost: number | null;
  plan: string;
  onboardingComplete: boolean;
  alertSmsEnabled: boolean;
  stripeCustomerId?: string | null;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    companyName: user.companyName,
    rbqLicenseClass: user.rbqLicenseClass,
    rbqLicenseNumber: user.rbqLicenseNumber,
    rbqVerified: user.rbqVerified,
    rbqVerifiedAt: user.rbqVerifiedAt,
    trades: user.trades,
    regions: user.regions,
    phone: user.phone,
    ampAuthorized: user.ampAuthorized,
    minProjectCost: user.minProjectCost,
    maxProjectCost: user.maxProjectCost,
    plan: user.plan,
    onboardingComplete: user.onboardingComplete,
    alertSmsEnabled: user.alertSmsEnabled,
    hasStripeCustomer: Boolean(user.stripeCustomerId),
  };
}
