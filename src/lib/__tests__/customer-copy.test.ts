import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");

const messageFiles = ["src/messages/fr.json", "src/messages/en.json"];

const visibleSourceFiles = [
  "src/app/[locale]/developers/page.tsx",
  "src/app/[locale]/feed/FeedClient.tsx",
  "src/app/[locale]/investigate/InvestigationCanvasClient.tsx",
  "src/app/[locale]/onboarding/OnboardingClient.tsx",
  "src/app/[locale]/opportunity-brief/OpportunityBriefClient.tsx",
  "src/app/[locale]/page.tsx",
  "src/app/[locale]/pricing/PricingClient.tsx",
  "src/app/[locale]/register/RegisterClient.tsx",
  "src/app/[locale]/vault/VaultClient.tsx",
  "src/app/[locale]/verdict/VerdictClient.tsx",
  "src/components/CockpitSidebar.tsx",
  "src/components/NavBar.tsx",
  "src/components/OpportunityDetailPanel.tsx",
  "src/components/OpportunityTable.tsx",
  "src/components/PublicContractorDesk.tsx",
  "src/components/QuebecIntelligenceSearch.tsx",
  "src/components/SiteFooter.tsx",
];

const bannedCustomerTerms = [
  { label: "PERMIS.AI", regex: /PERMIS\.AI/i },
  { label: "standalone AI/IA", regex: /\b(?:AI|IA)\b/i },
  { label: "assistant", regex: /\bassistant\b/i },
  { label: "copilot", regex: /\bcopilot\b/i },
];

const bannedMessageTerms = [
  ...bannedCustomerTerms,
  { label: "intelligence", regex: /\bintelligence\b/i },
];

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function collectStringValues(value: unknown, trail: string[] = []): Array<{ key: string; value: string }> {
  if (typeof value === "string") return [{ key: trail.join("."), value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStringValues(item, [...trail, String(index)]));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => collectStringValues(item, [...trail, key]));
  }
  return [];
}

function findViolations(
  entries: Array<{ key: string; value: string }>,
  rules: Array<{ label: string; regex: RegExp }>,
) {
  return entries.flatMap((entry) =>
    rules
      .filter((rule) => rule.regex.test(entry.value))
      .map((rule) => `${entry.key}: ${rule.label} in "${entry.value}"`),
  );
}

describe("customer-facing copy", () => {
  it("does not expose AI branding or assistant framing in message values", () => {
    const entries = messageFiles.flatMap((file) => {
      const parsed = JSON.parse(readRepoFile(file));
      return collectStringValues(parsed, [file]);
    });

    expect(findViolations(entries, bannedMessageTerms)).toEqual([]);
  });

  it("does not expose AI branding or assistant framing in visible UI source", () => {
    const entries = visibleSourceFiles.map((file) => ({
      key: file,
      value: readRepoFile(file),
    }));

    expect(findViolations(entries, bannedCustomerTerms)).toEqual([]);
  });
});
