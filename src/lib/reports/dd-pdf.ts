/**
 * Due-diligence investigation reports — branded, shareable PDFs.
 *
 * Property Investigation Report and Contractor Investigation Report, assembled
 * from the ontology (assessment, transactions, permits, zoning, constraints,
 * risk, ownership) — the deliverable contractors/investors hand to partners.
 * Server-side generation via jspdf so reports can be emailed/exported.
 */

import { jsPDF } from "jspdf";
import { prisma } from "@/lib/prisma";
import { assessPropertyRisk, assessContractorRisk } from "@/lib/risk/engine";
import type { PropertyRiskAssessment, ContractorRiskAssessment } from "@/lib/risk/engine";
import { datasetLabel } from "@/lib/evidence";

const INK: [number, number, number] = [14, 23, 38];
const MUTED: [number, number, number] = [81, 92, 110];
const BRAND: [number, number, number] = [37, 99, 235];
const DANGER: [number, number, number] = [220, 43, 70];
const SUCCESS: [number, number, number] = [10, 157, 99];
const WARNING: [number, number, number] = [185, 114, 10];
const LINE: [number, number, number] = [226, 232, 240];

function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toLocaleString("fr-CA")} $`;
}
function dateStr(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, 210, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ZONNING", 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Intelligence de construction — Québec", 14, 19);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 14, 33);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(subtitle, 14, 39);
  doc.setDrawColor(...LINE);
  doc.line(14, 42, 196, 42);
}

function footer(doc: jsPDF, generatedAt: string) {
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(
    `Généré par ZONNING le ${dateStr(generatedAt)} · Données publiques indexées · À confirmer auprès des sources officielles avant décision.`,
    14,
    290
  );
}

function toneColor(tone: string): [number, number, number] {
  if (tone === "high" || tone === "elevated") return tone === "high" ? DANGER : WARNING;
  return SUCCESS;
}

function sectionTitle(doc: jsPDF, y: number, label: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(label, 14, y);
  doc.setDrawColor(...LINE);
  doc.line(14, y + 1.5, 196, y + 1.5);
  return y + 7;
}

function kvRow(doc: jsPDF, y: number, label: string, value: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(label, 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  const wrapped = doc.splitTextToSize(value, 116);
  doc.text(wrapped, 80, y);
  return y + Math.max(5.5, wrapped.length * 5);
}

// ---- Property report -------------------------------------------------------

export async function generatePropertyReport(matricule: string): Promise<{ pdf: Uint8Array; filename: string } | null> {
  const unit = await prisma.propertyUnit.findUnique({ where: { matricule } });
  if (!unit) return null;

  const risk = await assessPropertyRisk(matricule);
  const permits = await prisma.permit.findMany({ where: { matricule }, orderBy: { issueDate: "desc" }, take: 15 });
  const transactions = await prisma.propertyTransaction.findMany({ where: { matricule }, orderBy: { saleDate: "desc" }, take: 10 });
  const taxes = await prisma.propertyTax.findMany({ where: { matricule }, orderBy: { year: "desc" }, take: 3 });
  const inspections = unit.address
    ? await prisma.municipalInspection.findMany({ where: { address: { contains: unit.address } }, take: 10 })
    : [];

  const doc = new jsPDF();
  header(doc, "Rapport d'investigation — Propriété", `Matricule ${matricule} · ${unit.address ?? unit.borough ?? ""}`);

  let y = 50;
  y = sectionTitle(doc, y, "Identification");
  y = kvRow(doc, y, "Matricule", unit.matricule);
  y = kvRow(doc, y, "Adresse", unit.address ?? "—");
  y = kvRow(doc, y, "Arrondissement", unit.borough ?? "—");
  y = kvRow(doc, y, "Année de construction", String(unit.yearBuilt ?? "—"));
  y = kvRow(doc, y, "Unités / étages", `${unit.units ?? "—"} / ${unit.floors ?? "—"}`);
  if (y > 250) { doc.addPage(); y = 20; }

  y += 2;
  y = sectionTitle(doc, y, "Évaluation foncière");
  y = kvRow(doc, y, "Valeur totale", money(unit.totalValue));
  y = kvRow(doc, y, "Valeur terrain", money(unit.landValue));
  y = kvRow(doc, y, "Valeur bâtiment", money(unit.buildingValue));
  y = kvRow(doc, y, "Superficie terrain", unit.landArea ? `${unit.landArea} m²` : "—");
  if (y > 240) { doc.addPage(); y = 20; }

  y += 2;
  y = sectionTitle(doc, y, "Évaluation du risque composite");
  if (risk) {
    const c = toneColor(risk.tone);
    doc.setFillColor(...c);
    doc.roundedRect(14, y - 4, 18, 12, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(String(risk.overallScore), 19, y + 4);
    doc.setTextColor(...INK);
    doc.setFontSize(10);
    doc.text(`Niveau: ${risk.tone}`, 36, y + 1);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Score composite 0–100 · ${risk.factors.length} facteur(s) de risque · ${risk.opportunities.length} signal(aux) d'opportunité`, 36, y + 6);
    y += 12;
    doc.setFontSize(8);
    for (const f of risk.factors.slice(0, 6)) {
      doc.setTextColor(...INK);
      doc.setFont("helvetica", "bold");
      doc.text(`• ${f.label} (${f.severity})`, 16, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      const wrapped = doc.splitTextToSize(f.detail, 175);
      doc.text(wrapped, 18, y + 4);
      y += 6 + wrapped.length * 4;
      if (y > 270) { doc.addPage(); y = 20; }
    }
  }

  if (risk?.opportunities.length) {
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...SUCCESS);
    doc.text("Signaux d'opportunité:", 14, y);
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    y += 5;
    for (const o of risk.opportunities) {
      doc.text(`• ${o.label}: ${o.detail}`, 16, y);
      y += 5;
    }
  }

  // Permits
  if (permits.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    y += 2;
    y = sectionTitle(doc, y, `Permis récents (${permits.length})`);
    doc.setFontSize(8);
    for (const p of permits.slice(0, 12)) {
      doc.setTextColor(...INK);
      doc.setFont("helvetica", "bold");
      doc.text(`${dateStr(p.issueDate)} · ${p.permitType}`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      const detail = `${money(p.estimatedCost)} · ${p.applicantName ?? "demandeur inconnu"} · ${datasetLabel("permits")}`;
      doc.text(detail, 14, y + 4);
      y += 9;
      if (y > 270) { doc.addPage(); y = 20; }
    }
  }

  // Transactions
  if (transactions.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    y += 2;
    y = sectionTitle(doc, y, `Ventes récentes (${transactions.length})`);
    doc.setFontSize(8);
    for (const t of transactions) {
      doc.setTextColor(...INK);
      doc.text(`${dateStr(t.saleDate)} · ${money(t.salePrice)} · ${t.buildingType ?? "—"}`, 14, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    }
  }

  // Tax + inspections
  if (taxes.length || inspections.length) {
    if (y > 230) { doc.addPage(); y = 20; }
    y += 2;
    y = sectionTitle(doc, y, "Taxes & inspections");
    doc.setFontSize(8);
    for (const tx of taxes) {
      doc.text(`Taxe ${tx.year}: ${money(tx.taxAmount)}`, 14, y);
      y += 5;
    }
    for (const ins of inspections) {
      doc.text(`Inspection: ${ins.violationType ?? "—"} (${dateStr(ins.inspectedAt)})`, 14, y);
      y += 5;
    }
  }

  footer(doc, new Date().toISOString());
  return {
    pdf: doc.output("arraybuffer") as unknown as Uint8Array,
    filename: `zonning-rapport-propriete-${matricule}.pdf`,
  };
}

// ---- Contractor report -----------------------------------------------------

export async function generateContractorReport(
  identifier: string,
  by: "rbq" | "neq"
): Promise<{ pdf: Uint8Array; filename: string } | null> {
  const risk = await assessContractorRisk(identifier, by);
  if (!risk) return null;

  let license: { licenseNumber: string; holderName: string | null; subclass: string | null; status: string; expiryDate: Date | null } | null = null;
  let company: { name: string; neq: string | null; rbqNumber: string | null; city: string | null; region: string | null; sector: string | null } | null = null;

  if (by === "rbq") {
    license = await prisma.rbqLicense.findUnique({ where: { licenseNumber: identifier } });
    company = (await prisma.company.findFirst({ where: { rbqNumber: identifier } })) ?? null;
  } else {
    company = await prisma.company.findUnique({ where: { neq: identifier } });
  }

  const infractions = by === "rbq" ? await prisma.rbqInfraction.findMany({ where: { licenseNumber: identifier }, take: 20 }) : [];
  const awards = (company?.name ? await prisma.tenderAward.findMany({ where: { winnerName: { contains: company.name } }, take: 15 }) : []);

  const doc = new jsPDF();
  const name = risk.name ?? company?.name ?? identifier;
  header(doc, "Rapport d'investigation — Entrepreneur", name);

  let y = 50;
  y = sectionTitle(doc, y, "Identification");
  y = kvRow(doc, y, "Nom", name);
  if (company?.neq) y = kvRow(doc, y, "NEQ", company.neq);
  if (license?.licenseNumber || company?.rbqNumber) y = kvRow(doc, y, "Licence RBQ", license?.licenseNumber ?? company?.rbqNumber ?? "—");
  if (license?.subclass) y = kvRow(doc, y, "Sous-classe", license.subclass);
  if (company?.city) y = kvRow(doc, y, "Ville", company.city);
  if (company?.sector) y = kvRow(doc, y, "Secteur", company.sector);

  y += 2;
  y = sectionTitle(doc, y, "Évaluation du risque");
  const c = toneColor(risk.tone);
  doc.setFillColor(...c);
  doc.roundedRect(14, y - 4, 18, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(String(risk.overallScore), 19, y + 4);
  doc.setTextColor(...INK);
  doc.setFontSize(10);
  doc.text(`Niveau: ${risk.tone}`, 36, y + 1);
  y += 12;

  if (risk.factors.length) {
    doc.setFontSize(8);
    for (const f of risk.factors) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...INK);
      doc.text(`• ${f.label} (${f.severity})`, 16, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      const wrapped = doc.splitTextToSize(f.detail, 175);
      doc.text(wrapped, 18, y + 4);
      y += 6 + wrapped.length * 4;
      if (y > 270) { doc.addPage(); y = 20; }
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Aucun facteur de risque indexé — vérifiez les sources officielles.", 16, y);
    y += 6;
  }

  if (infractions.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    y += 2;
    y = sectionTitle(doc, y, `Infractions RBQ (${infractions.length})`);
    doc.setFontSize(8);
    for (const inf of infractions) {
      doc.text(`${dateStr(inf.infractionDate)} · ${inf.description ?? "—"}`, 14, y);
      y += 6;
      if (y > 270) { doc.addPage(); y = 20; }
    }
  }

  if (awards.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    y += 2;
    y = sectionTitle(doc, y, `Adjudications récentes (${awards.length})`);
    doc.setFontSize(8);
    for (const a of awards) {
      doc.setTextColor(...INK);
      doc.text(`${dateStr(a.awardDate)} · ${money(a.awardAmount)}`, 14, y);
      doc.setTextColor(...MUTED);
      const wrapped = doc.splitTextToSize(a.title ?? "—", 175);
      doc.text(wrapped, 14, y + 4);
      y += 8 + wrapped.length * 4;
      if (y > 270) { doc.addPage(); y = 20; }
    }
  }

  if (risk.evidenceGaps.length) {
    if (y > 250) { doc.addPage(); y = 20; }
    y += 2;
    y = sectionTitle(doc, y, "Limites des données");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    for (const g of risk.evidenceGaps) {
      const w = doc.splitTextToSize(`• ${g}`, 175);
      doc.text(w, 14, y);
      y += w.length * 4 + 2;
    }
  }

  footer(doc, new Date().toISOString());
  return {
    pdf: doc.output("arraybuffer") as unknown as Uint8Array,
    filename: `zonning-rapport-entrepreneur-${identifier}.pdf`,
  };
}

export type { PropertyRiskAssessment, ContractorRiskAssessment };
