import { describe, expect, it } from "vitest";
import { extractDeterministic } from "@/lib/vault/extract";

const SAMPLE = `
AVIS D'APPEL D'OFFRES — Rénovation de l'hôtel de ville
Organisme : Ville de Sainte-Exemple
Valeur estimative : 1 250 000 $

Le soumissionnaire doit détenir une licence RBQ valide et fournir une
attestation de Revenu Québec. Un cautionnement de soumission de 10 % est exigé,
ainsi qu'un certificat d'assurance responsabilité de 2 000 000 $.

Toute soumission incomplète sera rejetée automatiquement.

La déclaration de lobbyisme / non-collusion doit être jointe.

Addenda 2 publié le 15 juin 2026.

Date limite de réception des soumissions : 30 juillet 2026 à 14h00.
Dépôt électronique via SEAO. Contact : bids@sainte-exemple.qc.ca
`;

describe("extractDeterministic", () => {
  const result = extractDeterministic(SAMPLE);

  it("detects RBQ and Revenu Québec requirements", () => {
    expect(result.requiresRbq).toBe(true);
    expect(result.revenuQuebecRequired).toBe(true);
  });

  it("detects bonding and insurance requirements", () => {
    expect(result.bondRequirements.length).toBeGreaterThan(0);
    expect(result.insuranceRequirements.length).toBeGreaterThan(0);
  });

  it("flags automatic-rejection risk", () => {
    expect(result.rejectionRisks.length).toBeGreaterThan(0);
  });

  it("captures the mandatory declaration", () => {
    expect(result.requiredDocuments.some((d) => /collusion/i.test(d))).toBe(true);
  });

  it("notes addenda", () => {
    expect(result.addendaNoted).toBe(true);
  });

  it("extracts a deadline and submission method", () => {
    expect(result.deadlines.length).toBeGreaterThan(0);
    expect(result.submissionMethod).toMatch(/SEAO|électronique/i);
  });

  it("builds a non-empty task board with blockers", () => {
    expect(result.tasks.length).toBeGreaterThan(3);
    expect(result.blockerCount).toBeGreaterThan(0);
    expect(result.tasks.some((t) => t.category === "rbq" && t.blocker)).toBe(true);
  });

  it("extracts contact emails", () => {
    expect(result.contactRules.some((c) => c.includes(" bids@"))).toBe(true);
  });
});
