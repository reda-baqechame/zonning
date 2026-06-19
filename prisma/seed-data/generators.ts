/**
 * Pure demo-data generators. Each returns plain objects ready for
 * `prisma.<model>.createMany`. They take an `Rng` so output is deterministic
 * and idempotent (stable externalIds → upserts replace rather than duplicate).
 *
 * Volumes are tuned to make every page render with believable density across
 * all of Québec without bloating the SQLite dev file.
 */
import { getRequiredRbqClasses } from "../../src/lib/rbq";
import { Rng, hashSeed } from "./rng";
import { CITY_GEO, COVERAGE_CITY_NAMES, scatter, streetsFor } from "./geo";

const QC = "https://www.donneesquebec.ca/recherche/dataset";

export const PERMIT_TYPES = [
  "Rénovation commerciale",
  "Construction résidentielle",
  "Installation électrique",
  "Plomberie",
  "Chauffage et climatisation (CVAC)",
  "Maçonnerie",
  "Coffrage et béton",
  "Démolition",
  "Toiture",
  "Excavation",
  "Agrandissement",
  "Aménagement intérieur",
];

const APPLICANT_SUFFIXES = ["Inc.", "Ltée", "S.E.N.C.", "Construction", "& Fils", "Group"];
const APPLICANT_ROOTS = [
  "Boréal",
  "Saint-Laurent",
  "Lafleur",
  "Bélanger",
  "Tremblay",
  "Côté",
  "Gauthier",
  "Maxim",
  "Royal",
  "Mercier",
  "Laurentide",
  "Alliance",
  "Atlas",
  "Vortex",
  "Cardinal",
];

function applicant(rng: Rng): string {
  return `${rng.pick(APPLICANT_ROOTS)} ${rng.pick(["Bâtiment", "Construction", "Électrique", "Mécanique", "Rénovation"])} ${rng.pick(APPLICANT_SUFFIXES)}`;
}

// ---------------------------------------------------------------------------
// Permits — spread across every coverage city with real-ish coordinates.
// ---------------------------------------------------------------------------
export function generatePermits(perCity = 34) {
  const out: Record<string, unknown>[] = [];
  for (const cityName of COVERAGE_CITY_NAMES) {
    const geo = CITY_GEO[cityName]!;
    const rng = new Rng(hashSeed(`permits:${cityName}`));
    const streets = streetsFor(geo);
    for (let i = 0; i < perCity; i++) {
      const permitType = PERMIT_TYPES[i % PERMIT_TYPES.length]!;
      const sector = rng.pick(geo.sectors);
      const street = rng.pick(streets);
      const num = rng.int(100, 8900);
      const { lat, lng } = scatter(geo, rng.float(-1, 1), rng.float(-1, 1));
      const estimatedCost = rng.int(35, 1800) * 1000;
      const daysAgo = rng.int(1, 280);
      out.push({
        externalId: `seed-permit-${cityName}-${i}`,
        permitNumber: `PM-2026-${hashSeed(cityName) % 900}-${1000 + i}`,
        permitType,
        workType: `Travaux: ${permitType.toLowerCase()}`,
        borough: sector,
        matricule: `${hashSeed(cityName) % 9999}-${100000 + i}`,
        address: `${num} ${street}`,
        city: cityName,
        latitude: lat,
        longitude: lng,
        estimatedCost,
        issueDate: new Date(Date.now() - daysAgo * 86_400_000),
        applicantName: applicant(rng),
        applicantContact: `projets${i}@${rng.pick(APPLICANT_ROOTS).toLowerCase()}.ca`,
        requiredRbqClasses: JSON.stringify(getRequiredRbqClasses(permitType)),
        sourceUrl: `${QC}/vmtl-permis-construction`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tenders + awards + amendments — feed win-probability & incumbent features.
// ---------------------------------------------------------------------------
const TENDER_TITLES = [
  "Réfection de toiture — école primaire",
  "Installation électrique — pavillon CIUSSS",
  "Fourniture de matériaux de construction",
  "Entretien CVAC — bâtiment municipal",
  "Rénovation plomberie — centre sportif",
  "Réaménagement de bibliothèque",
  "Construction d'un poste de pompage",
  "Réfection de chaussée et trottoirs",
  "Services d'ingénierie — pont municipal",
  "Mise aux normes incendie — caserne",
  "Aménagement paysager — parc urbain",
  "Démolition et décontamination de site",
];
const BUYERS = [
  "Ville de Montréal",
  "Ministère des Transports (MTQ)",
  "CIUSSS du Centre-Sud",
  "Hydro-Québec",
  "Société québécoise des infrastructures",
  "Ville de Québec",
  "Ville de Laval",
  "Commission scolaire de Montréal",
];
const UNSPSC = ["72141100", "72151500", "81101500", "30171500", "72102900", "95121500"];
const CATEGORIES = ["Travaux de construction", "Services", "Approvisionnement"];

export function generateTenders(count = 64) {
  const rng = new Rng(hashSeed("tenders"));
  const now = Date.now();
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const daysToClose = rng.int(-20, 45); // some already closed (for award linkage)
    const closesAt = new Date(now + daysToClose * 86_400_000);
    const region = rng.pick(COVERAGE_CITY_NAMES);
    const category = rng.pick(CATEGORIES);
    const requiresAmp = rng.bool(0.35);
    out.push({
      externalId: `seed-tender-${i}`,
      title: `${rng.pick(TENDER_TITLES)} — ${region}`,
      organization: rng.pick(BUYERS),
      category,
      region,
      estimatedValue: rng.int(60, 4200) * 1000,
      publishedAt: new Date(now - rng.int(2, 40) * 86_400_000),
      closesAt,
      summary:
        "Appel d'offres public publié sur le SEAO. Soumission requise avant la clôture.",
      description:
        "Le présent appel d'offres vise la réalisation des travaux décrits aux documents. " +
        "Cautionnement de soumission de 10 % exigé. Assurance responsabilité de 2 M$ requise. " +
        "Visite des lieux obligatoire. Garantie d'exécution de 50 % à l'adjudication.",
      requiresAmp,
      unspsc: rng.pick(UNSPSC),
      status: daysToClose < 0 ? "closed" : "active",
      sourceUrl: `${QC}/systeme-electronique-dappel-doffres-seao`,
    });
  }
  return out;
}

const WINNERS = [
  "Construction Boréal Inc.",
  "Groupe Mécanique Saint-Laurent",
  "Électro-Sud Montréal",
  "Béton Laurentides",
  "Toitures Cardinal Ltée",
  "Excavation Mercier & Fils",
  "Aménagements Atlas",
  "Plomberie Vortex Inc.",
];

export function generateAwards(count = 80) {
  const rng = new Rng(hashSeed("awards"));
  const now = Date.now();
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const award = rng.int(70, 5200) * 1000;
    const overrun = rng.bool(0.4) ? rng.float(1.01, 1.22) : 1;
    out.push({
      externalId: `seed-award-${i}`,
      title: `${rng.pick(TENDER_TITLES)}`,
      winnerName: rng.pick(WINNERS),
      buyerName: rng.pick(BUYERS),
      awardAmount: award,
      finalValue: Math.round(award * overrun),
      contractStatus: rng.pick(["adjugé", "en cours", "complété"]),
      unspsc: rng.pick(UNSPSC),
      category: rng.pick(CATEGORIES),
      region: rng.pick(COVERAGE_CITY_NAMES),
      awardDate: new Date(now - rng.int(30, 900) * 86_400_000),
      sourceUrl: `${QC}/systeme-electronique-dappel-doffres-seao`,
    });
  }
  return out;
}

export function generateAmendments(count = 24) {
  const rng = new Rng(hashSeed("amendments"));
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    externalId: `seed-amend-${i}`,
    contractId: `C-${10000 + i}`,
    tenderExternalId: `seed-tender-${rng.int(0, 40)}`,
    title: `Addenda ${rng.int(1, 4)} — ${rng.pick(TENDER_TITLES)}`,
    amendmentType: rng.pick(["Modification de quantité", "Prolongation de délai", "Ajout de bordereau", "Correctif"]),
    amount: rng.bool(0.6) ? rng.int(5, 320) * 1000 : null,
    amendedAt: new Date(now - rng.int(1, 60) * 86_400_000),
    sourceUrl: `${QC}/systeme-electronique-dappel-doffres-seao`,
  }));
}

// ---------------------------------------------------------------------------
// Contractor graph — RBQ licences + infractions + AMP + companies + suppliers.
// ---------------------------------------------------------------------------
const RBQ_SUBCLASSES = ["1.1.1", "1.3", "4.1", "5.1", "6.1", "7", "10.1", "13", "15.5"];

export function generateRbqLicenses(count = 40) {
  const rng = new Rng(hashSeed("rbq"));
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      licenseNumber: `${5000 + i}-${1000 + (i % 9) * 111}-01`,
      holderName: rng.pick(WINNERS) + (i > WINNERS.length ? ` ${i}` : ""),
      subclass: rng.pick(RBQ_SUBCLASSES),
      status: rng.bool(0.92) ? "active" : "suspended",
      expiryDate: new Date(Date.now() + rng.int(30, 700) * 86_400_000),
      sourceUrl: "https://www.rbq.gouv.qc.ca/",
    });
  }
  // Guarantee the demo PRO user's licence exists.
  out.push({
    licenseNumber: "1234-5678-01",
    holderName: "Dupont Électrique Inc.",
    subclass: "4.1",
    status: "active",
    expiryDate: new Date(Date.now() + 500 * 86_400_000),
    sourceUrl: "https://www.rbq.gouv.qc.ca/",
  });
  return out;
}

export function generateRbqInfractions(licenses: Record<string, unknown>[]) {
  const rng = new Rng(hashSeed("infractions"));
  const out: Record<string, unknown>[] = [];
  let n = 0;
  for (const lic of licenses) {
    if (!rng.bool(0.18)) continue;
    out.push({
      externalId: `seed-infraction-${n++}`,
      licenseNumber: lic.licenseNumber as string,
      holderName: lic.holderName as string,
      description: rng.pick([
        "Travaux sans détenir la licence appropriée",
        "Non-respect du Code de construction",
        "Défaut de cautionnement",
        "Publicité trompeuse",
      ]),
      infractionDate: new Date(Date.now() - rng.int(60, 1200) * 86_400_000),
      sourceUrl: "https://www.rbq.gouv.qc.ca/",
    });
  }
  return out;
}

export function generateAmpAuthorizations(licenses: Record<string, unknown>[]) {
  const rng = new Rng(hashSeed("amp"));
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const lic of licenses) {
    const num = lic.licenseNumber as string;
    if (seen.has(num) || !rng.bool(0.4)) continue;
    seen.add(num);
    out.push({
      licenseNumber: num,
      holderName: lic.holderName as string,
      ampClass: rng.pick(["Construction", "Services", "Approvisionnement"]),
      status: rng.bool(0.9) ? "autorisée" : "en traitement",
      sourceUrl: "https://www.amp.gouv.qc.ca/",
    });
  }
  return out;
}

const SECTORS = ["Fabrication métallique", "HVAC", "Béton", "Électricité", "Excavation", "Toiture", "Transport", "Génie civil"];

export function generateCompanies(count = 36) {
  const rng = new Rng(hashSeed("companies"));
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const cityName = rng.pick(COVERAGE_CITY_NAMES);
    const geo = CITY_GEO[cityName]!;
    const name = `${rng.pick(APPLICANT_ROOTS)} ${rng.pick(SECTORS)} ${rng.pick(APPLICANT_SUFFIXES)}`;
    out.push({
      name,
      neq: `117${String(1000000 + i).slice(0, 7)}`,
      city: cityName,
      region: geo.region,
      sector: rng.pick(SECTORS),
      certifications: JSON.stringify(rng.sample(["ISO 9001", "ISO 14001", "COR", "CCQ", "RBQ"], rng.int(1, 3))),
      capabilities: JSON.stringify(rng.sample(["acier", "soudure", "béton", "électrique", "CVAC", "excavation", "commercial", "industriel", "institutionnel"], rng.int(2, 4))),
      rbqNumber: `${5000 + (i % 40)}-${1000 + (i % 9) * 111}-01`,
      sourceUrl: `${QC}/registre-des-entreprises`,
      email: `info@${rng.pick(APPLICANT_ROOTS).toLowerCase()}${i}.ca`,
      phone: `514-${rng.int(200, 999)}-${rng.int(1000, 9999)}`,
      isSupplier: rng.bool(0.3),
    });
  }
  return out;
}

export function generateSuppliers(count = 18) {
  const rng = new Rng(hashSeed("suppliers"));
  return Array.from({ length: count }, (_, i) => {
    const cityName = rng.pick(COVERAGE_CITY_NAMES);
    const geo = CITY_GEO[cityName]!;
    return {
      externalId: `seed-supplier-${i}`,
      supplierNumber: `F-${10000 + i}`,
      name: `${rng.pick(APPLICANT_ROOTS)} Fournitures ${rng.pick(["Industrielles", "Construction", "Pro"])}`,
      neq: `117${String(2000000 + i).slice(0, 7)}`,
      borough: rng.pick(geo.sectors),
      address: `${rng.int(100, 5000)} ${rng.pick(streetsFor(geo))}`,
      phone: `438-${rng.int(200, 999)}-${rng.int(1000, 9999)}`,
      sourceUrl: `${QC}/vmtl-liste-des-fournisseurs`,
    };
  });
}
