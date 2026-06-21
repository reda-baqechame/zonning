/**
 * Composite risk engine — the "should I build / buy / work here?" verdict.
 *
 * Fuses every constraint layer ZONNING indexes into one defensible score,
 * fully decomposed into evidence-backed factors. This is what turns raw
 * Quebec data into a decision: a contractor/investor sees not just "risky"
 * but *why*, each factor traceable to its source record.
 *
 * Property risk = contamination + heritage + municipal inspections + (flood,
 * CPTAQ, wetlands when ingested). Opportunity = undervaluation vs recent
 * sales + market heat — surfaced alongside risk so the user sees both the
 * danger and the upside.
 */

import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/datasets/geo";
import { evidenceFromRow } from "@/lib/evidence";
import type { Evidence } from "@/lib/ontology/types";

export type RiskTone = "low" | "moderate" | "elevated" | "high";

export interface RiskFactor {
  id: string;
  label: string;
  /** 0–100 severity contribution. */
  severity: number;
  tone: RiskTone;
  detail: string;
  evidence: Evidence;
}

export interface PropertyRiskAssessment {
  matricule: string;
  address?: string | null;
  borough?: string | null;
  overallScore: number; // 0–100 (higher = riskier)
  tone: RiskTone;
  factors: RiskFactor[];
  /** Upside signals, surfaced beside risk. */
  opportunities: RiskFactor[];
  assessedAt: string;
  evidenceGaps: string[];
}

const NEARBY_KM = 0.5;

function toneFor(score: number): RiskTone {
  if (score >= 66) return "high";
  if (score >= 40) return "elevated";
  if (score >= 20) return "moderate";
  return "low";
}

export async function assessPropertyRisk(matricule: string): Promise<PropertyRiskAssessment | null> {
  const unit = await prisma.propertyUnit.findUnique({ where: { matricule } });
  if (!unit) return null;

  const factors: RiskFactor[] = [];
  const opportunities: RiskFactor[] = [];
  const evidenceGaps: string[] = [];

  const lat = await resolvePropertyLat(matricule);
  const lng = await resolvePropertyLng(matricule);

  // 1. Contamination nearby (GTC provincial + Montréal)
  if (lat != null && lng != null) {
    const contaminated = await prisma.contaminatedSite.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      take: 2000,
    });
    let nearestDist = Infinity;
    let nearestStatus: string | null = null;
    let count = 0;
    let gtcCount = 0;
    for (const c of contaminated) {
      if (c.latitude == null || c.longitude == null) continue;
      const d = haversineKm(lat, lng, c.latitude, c.longitude);
      if (d <= NEARBY_KM) {
        count++;
        if (c.sourceLayer === "gtc") gtcCount++;
        if (d < nearestDist) {
          nearestDist = d;
          nearestStatus = c.status;
        }
      }
    }
    if (count > 0) {
      const severity = Math.min(90, 40 + count * 12 + gtcCount * 8);
      factors.push({
        id: "contamination",
        label: "Terrains contaminés à proximité",
        severity,
        tone: toneFor(severity),
        detail: `${count} site(s) dans un rayon de 500 m${gtcCount ? ` · ${gtcCount} au registre provincial GTC` : ""}. Statut le plus proche : ${nearestStatus ?? "inconnu"}.`,
        evidence: evidenceFromRow(
          gtcCount > 0 ? "contamination-gtc" : "contamination",
          { id: matricule, sourceUrl: null }
        ),
      });
    }
  } else {
    evidenceGaps.push("Coordonnées géospatiales du terrain indisponibles — analyse de proximité limitée.");
  }

  // 2. Heritage constraints nearby
  if (lat != null && lng != null) {
    const heritage = await prisma.heritageSite.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      take: 2000,
    });
    let count = 0;
    for (const h of heritage) {
      if (h.latitude == null || h.longitude == null) continue;
      if (haversineKm(lat, lng, h.latitude, h.longitude) <= NEARBY_KM) count++;
    }
    if (count > 0) {
      const severity = Math.min(55, 20 + count * 10);
      factors.push({
        id: "heritage",
        label: "Contraintes patrimoniales à proximité",
        severity,
        tone: toneFor(severity),
        detail: `${count} site(s) patrimonial(ux) dans un rayon de 500 m — restrictions possibles sur les travaux extérieurs et la démolition.`,
        evidence: evidenceFromRow("heritage", { id: matricule, sourceUrl: null }),
      });
    }
  }

  // 3. Municipal inspections / violations at the address
  if (unit.address) {
    const inspections = await prisma.municipalInspection.findMany({
      where: { address: { contains: unit.address } },
      take: 20,
    });
    if (inspections.length > 0) {
      const severity = Math.min(60, 15 + inspections.length * 12);
      factors.push({
        id: "inspection",
        label: "Infractions / inspections municipales",
        severity,
        tone: toneFor(severity),
        detail: `${inspections.length} signalement(s) à cette adresse — type le plus fréquent : ${mode(inspections.map((i) => i.violationType))}.`,
        evidence: evidenceFromRow("inspection-violations-mtl", { id: matricule, sourceUrl: null }),
      });
    }
  }

  // Opportunity 1: undervaluation vs recent sales in the borough
  if (unit.totalValue && unit.borough) {
    const comps = await prisma.propertyTransaction.findMany({
      where: { borough: unit.borough, salePrice: { not: null } },
      orderBy: { saleDate: "desc" },
      take: 200,
    });
    if (comps.length >= 5) {
      const prices = comps.map((c) => c.salePrice!).filter((p) => p > 0);
      const medianPrice = median(prices);
      const ratio = unit.totalValue / medianPrice;
      if (ratio < 0.85) {
        const upside = Math.round((1 - ratio) * 100);
        opportunities.push({
          id: "undervalued",
          label: "Sous-évaluation vs ventes récentes",
          severity: upside,
          tone: "low",
          detail: `Évaluation foncière ${Math.round(ratio * 100)}% de la médiane des ventes récentes de l'arrondissement (${medianPrice.toLocaleString("fr-CA")} $).`,
          evidence: evidenceFromRow("transactions", { id: matricule, sourceUrl: null }),
        });
      }
    } else {
      evidenceGaps.push("Ventes comparables insuffisantes dans l'arrondissement pour estimer la sous-évaluation.");
    }
  }

  // Opportunity 2: permit heat nearby (market activity / redevelopment signal)
  if (lat != null && lng != null) {
    const since = new Date(Date.now() - 90 * 86_400_000);
    const recentPermits = await prisma.permit.findMany({
      where: { issueDate: { gte: since }, latitude: { not: null }, longitude: { not: null } },
      take: 4000,
    });
    let nearby = 0;
    for (const p of recentPermits) {
      if (p.latitude == null || p.longitude == null) continue;
      if (haversineKm(lat, lng, p.latitude, p.longitude) <= 1) nearby++;
    }
    if (nearby >= 5) {
      opportunities.push({
        id: "market_heat",
        label: "Activité de permis élevée à proximité",
        severity: Math.min(100, nearby * 6),
        tone: "low",
        detail: `${nearby} permis émis dans un rayon de 1 km au cours des 90 derniers jours — marché actif / potentiel de valorisation.`,
        evidence: evidenceFromRow("permits", { id: matricule, sourceUrl: null }),
      });
    }
  }

  if (lat == null) evidenceGaps.push("Zonage et zones inondables non évalués (coordonnées manquantes).");

  const overallScore = factors.length
    ? Math.min(100, Math.round(factors.reduce((s, f) => s + f.severity, 0) / Math.max(1, factors.length) + factors.length * 4))
    : 0;

  return {
    matricule,
    address: unit.address,
    borough: unit.borough,
    overallScore,
    tone: toneFor(overallScore),
    factors: factors.sort((a, b) => b.severity - a.severity),
    opportunities: opportunities.sort((a, b) => b.severity - a.severity),
    assessedAt: new Date().toISOString(),
    evidenceGaps,
  };
}

// ---- Contractor risk --------------------------------------------------------

export interface ContractorRiskAssessment {
  identifier: string; // rbq number or neq
  name?: string | null;
  overallScore: number;
  tone: RiskTone;
  factors: RiskFactor[];
  assessedAt: string;
  evidenceGaps: string[];
}

export async function assessContractorRisk(
  identifier: string,
  by: "rbq" | "neq"
): Promise<ContractorRiskAssessment | null> {
  const factors: RiskFactor[] = [];
  const evidenceGaps: string[] = [];
  let name: string | null = null;

  if (by === "rbq") {
    const lic = await prisma.rbqLicense.findUnique({ where: { licenseNumber: identifier } });
    if (lic) {
      name = lic.holderName;
      // License status
      if (lic.status !== "active") {
        factors.push({
          id: "license_status",
          label: `Licence RBQ ${lic.status}`,
          severity: 70,
          tone: "high",
          detail: `La licence ${identifier} a le statut « ${lic.status} ». Vérifiez l'admissibilité avant tout contrat.`,
          evidence: evidenceFromRow("rbq", lic),
        });
      }
      if (lic.expiryDate && lic.expiryDate < new Date()) {
        factors.push({
          id: "expired",
          label: "Licence expirée",
          severity: 80,
          tone: "high",
          detail: `La licence a expiré le ${lic.expiryDate.toISOString().slice(0, 10)}.`,
          evidence: evidenceFromRow("rbq", lic),
        });
      }
      // Infractions
      const infractions = await prisma.rbqInfraction.findMany({
        where: { licenseNumber: identifier },
        take: 50,
      });
      if (infractions.length > 0) {
        const severity = Math.min(90, 30 + infractions.length * 15);
        factors.push({
          id: "infractions",
          label: "Infractions RBQ",
          severity,
          tone: toneFor(severity),
          detail: `${infractions.length} infraction(s) enregistrée(s) à cette licence.`,
          evidence: evidenceFromRow("rbq-infractions", { id: identifier, sourceUrl: infractions[0]?.sourceUrl ?? null }),
        });
      } else {
        evidenceGaps.push("Aucune infraction RBQ indexée — absence de signalement, pas une garantie.");
      }
      // AMP authorization
      const amp = await prisma.ampAuthorization.findUnique({ where: { licenseNumber: identifier } });
      if (amp && amp.status && amp.status !== "active") {
        factors.push({
          id: "amp",
          label: "Autorisation AMP non active",
          severity: 35,
          tone: "moderate",
          detail: `Statut AMP : ${amp.status}. Requis pour les travaux publics municipaux.`,
          evidence: evidenceFromRow("amp-registry", amp),
        });
      }
    } else {
      evidenceGaps.push("Aucune licence RBQ trouvée à ce numéro — vérifiez le numéro ou l'existence de l'entreprise.");
    }
  } else {
    // NEQ — resolve to a company and its RBQ
    const company = await prisma.company.findUnique({ where: { neq: identifier } });
    if (!company) {
      evidenceGaps.push("Aucune entreprise trouvée à ce NEQ.");
    } else {
      name = company.name;
      if (company.rbqNumber) {
        const sub = await assessContractorRisk(company.rbqNumber, "rbq");
        if (sub) {
          return { ...sub, identifier, name: name };
        }
      } else {
        evidenceGaps.push("L'entreprise n'a pas de numéro RBQ associé dans le registre.");
      }
    }
  }

  const overallScore = factors.length
    ? Math.min(100, Math.round(factors.reduce((s, f) => s + f.severity, 0) / factors.length))
    : 0;

  return {
    identifier,
    name,
    overallScore,
    tone: toneFor(overallScore),
    factors,
    assessedAt: new Date().toISOString(),
    evidenceGaps,
  };
}

// ---- helpers ----------------------------------------------------------------

async function resolvePropertyLat(matricule: string): Promise<number | null> {
  const p = await prisma.permit.findFirst({ where: { matricule, latitude: { not: null } } });
  return p?.latitude ?? null;
}
async function resolvePropertyLng(matricule: string): Promise<number | null> {
  const p = await prisma.permit.findFirst({ where: { matricule, longitude: { not: null } } });
  return p?.longitude ?? null;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode(values: (string | null | undefined)[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = "—";
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}
