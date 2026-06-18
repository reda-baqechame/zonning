import { prisma } from "@/lib/prisma";
import { normalizeLicenseNumber } from "@/lib/datasets/fetchers/rbq";
import { computeRbqFitScore, getRequiredRbqClasses } from "@/lib/rbq";

export type RbqVerification = {
  verified: boolean;
  status: "active" | "expired" | "revoked" | "not_found" | "unverified";
  subclass?: string | null;
  holderName?: string | null;
  expiryDate?: Date | null;
};

export async function lookupRbqLicense(licenseNumber: string): Promise<RbqVerification> {
  const normalized = normalizeLicenseNumber(licenseNumber);
  const record = await prisma.rbqLicense.findUnique({
    where: { licenseNumber: normalized },
  });

  if (!record) {
    return { verified: false, status: "not_found" };
  }

  if (record.status === "revoked" || record.status === "suspendu") {
    return {
      verified: false,
      status: "revoked",
      subclass: record.subclass,
      holderName: record.holderName,
      expiryDate: record.expiryDate,
    };
  }

  if (record.expiryDate && record.expiryDate < new Date()) {
    return {
      verified: false,
      status: "expired",
      subclass: record.subclass,
      holderName: record.holderName,
      expiryDate: record.expiryDate,
    };
  }

  return {
    verified: true,
    status: "active",
    subclass: record.subclass,
    holderName: record.holderName,
    expiryDate: record.expiryDate,
  };
}

export async function verifyAndUpdateUserRbq(
  userId: string,
  licenseNumber?: string | null,
  licenseClass?: string | null
): Promise<RbqVerification> {
  if (!licenseNumber) {
    await prisma.user.update({
      where: { id: userId },
      data: { rbqVerified: false, rbqVerifiedAt: null },
    });
    return { verified: false, status: "unverified" };
  }

  const verification = await lookupRbqLicense(licenseNumber);
  const verified = verification.verified;

  await prisma.user.update({
    where: { id: userId },
    data: {
      rbqVerified: verified,
      rbqVerifiedAt: verified ? new Date() : null,
      ...(verification.subclass && !licenseClass
        ? { rbqLicenseClass: verification.subclass }
        : {}),
    },
  });

  return verification;
}

export function computeVerifiedRbqFit(
  userLicenseClass: string | null | undefined,
  userLicenseNumber: string | null | undefined,
  rbqVerified: boolean,
  permitType: string,
  workType?: string | null
) {
  const required = getRequiredRbqClasses(permitType, workType);
  const base = computeRbqFitScore(userLicenseClass, required);

  if (!userLicenseNumber) {
    return {
      ...base,
      score: Math.min(base.score, 40),
      eligible: false,
      reasonFr: "Ajoutez votre no de licence RBQ pour vérification",
      reasonEn: "Add your RBQ license number for verification",
    };
  }

  if (!rbqVerified) {
    return {
      ...base,
      score: Math.min(base.score, 50),
      eligible: false,
      reasonFr: "Licence RBQ non vérifiée dans le registre",
      reasonEn: "RBQ license not verified in registry",
    };
  }

  return base;
}
