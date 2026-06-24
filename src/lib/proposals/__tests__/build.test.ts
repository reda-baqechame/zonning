import { describe, expect, it } from "vitest";
import {
  buildCapabilityStatement,
  buildPricingSkeleton,
  buildProposalOutline,
} from "@/lib/proposals/build";
import type { ReadinessProfile } from "@/lib/readiness-passport";

const profile: ReadinessProfile = {
  companyName: "Test Construction Inc.",
  email: "bid@test.ca",
  neq: "1234567890",
  rbqLicenseNumber: "1234-5678",
  rbqLicenseClass: "1.2",
  rbqVerified: true,
  trades: ["general"],
  regions: ["Montreal"],
  ampAuthorized: true,
  revenuQuebecStatus: "valid",
  lobbyismDeclarationOnFile: true,
  signingResolutionOnFile: true,
  referencesCount: 3,
  employeesCount: 12,
};

describe("buildCapabilityStatement", () => {
  it("includes company identity and RBQ sections", () => {
    const stmt = buildCapabilityStatement(profile, "en");
    expect(stmt.sections.length).toBeGreaterThanOrEqual(4);
    expect(stmt.sections[0].body).toContain("Test Construction Inc.");
    expect(stmt.sections[1].body).toContain("1234-5678");
  });
});

describe("buildProposalOutline", () => {
  it("includes mandatory attestation section", () => {
    const outline = buildProposalOutline({
      tender: {
        title: "Renovation project",
        sourceUrl: "https://seao.ca/x",
      },
      locale: "en",
    });
    expect(outline.sections.some((s) => s.mandatory)).toBe(true);
  });
});

describe("buildPricingSkeleton", () => {
  it("labels totals as estimated", () => {
    const pricing = buildPricingSkeleton({ estimatedValue: 1_000_000, locale: "en" });
    expect(pricing.disclaimer.toLowerCase()).toContain("estimated");
    expect(pricing.lineItems.length).toBeGreaterThan(0);
  });
});
