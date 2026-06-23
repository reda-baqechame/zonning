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
  // Government Readiness Passport — tracked compliance profile.
  neq?: string | null;
  revenuQuebecStatus?: string | null;
  revenuQuebecExpiresAt?: string | null;
  cnesstStatus?: string | null;
  oqlfStatus?: string | null;
  insuranceCarrier?: string | null;
  insuranceExpiresAt?: string | null;
  insuranceLimit?: number | null;
  bidBondCapacity?: number | null;
  lobbyismDeclarationOnFile?: boolean;
  signingResolutionOnFile?: boolean;
  referencesCount?: number;
  employeesCount?: number;
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
  neq?: string | null;
  revenuQuebecStatus?: string | null;
  revenuQuebecExpiresAt?: Date | string | null;
  cnesstStatus?: string | null;
  oqlfStatus?: string | null;
  insuranceCarrier?: string | null;
  insuranceExpiresAt?: Date | string | null;
  insuranceLimit?: number | null;
  bidBondCapacity?: number | null;
  lobbyismDeclarationOnFile?: boolean;
  signingResolutionOnFile?: boolean;
  referencesCount?: number;
  employeesCount?: number;
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
    neq: user.neq ?? null,
    revenuQuebecStatus: user.revenuQuebecStatus ?? null,
    revenuQuebecExpiresAt:
      user.revenuQuebecExpiresAt instanceof Date
        ? user.revenuQuebecExpiresAt.toISOString()
        : (user.revenuQuebecExpiresAt ?? null),
    cnesstStatus: user.cnesstStatus ?? null,
    oqlfStatus: user.oqlfStatus ?? null,
    insuranceCarrier: user.insuranceCarrier ?? null,
    insuranceExpiresAt:
      user.insuranceExpiresAt instanceof Date
        ? user.insuranceExpiresAt.toISOString()
        : (user.insuranceExpiresAt ?? null),
    insuranceLimit: user.insuranceLimit ?? null,
    bidBondCapacity: user.bidBondCapacity ?? null,
    lobbyismDeclarationOnFile: user.lobbyismDeclarationOnFile ?? false,
    signingResolutionOnFile: user.signingResolutionOnFile ?? false,
    referencesCount: user.referencesCount ?? 0,
    employeesCount: user.employeesCount ?? 0,
  };
}
