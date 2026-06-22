/**
 * Intelligence layers. Two tiers:
 *  1. SHOWCASE_ADDRESSES — a curated set of addresses with every layer
 *     co-located at the same coordinates so /verdict and /intelligence return
 *     a fully-populated report. Addresses are accent-free in their first ~20
 *     chars so SQLite's case-insensitive LIKE lookup matches reliably.
 *  2. Broad per-city scatter so maps and coordinate-based features have density
 *     everywhere ZONNING claims coverage.
 */
import { Rng, hashSeed } from "./rng";
import { CITY_GEO, COVERAGE_CITY_NAMES, scatter, streetsFor } from "./geo";
import { squarePolygon, geometryBBox } from "../../src/lib/zoning/geometry";

const QC = "https://www.donneesquebec.ca/recherche/dataset";

export type Showcase = {
  key: string;
  address: string;
  city: string;
  borough: string;
  lat: number;
  lng: number;
  matricule: string;
  intensification: "Élevée" | "Moyenne" | "Faible";
  heritage?: "lpc" | "eip" | "pum2050";
  contamination?: "mtl" | "gtc";
  roadwork?: boolean;
  devProject?: boolean;
};

/** Curated showcase parcels — what a prospect should type to see the magic. */
// Street names are intentionally unique to the showcase set (absent from the
// generic per-city street pools in geo.ts) so resolveCoordinatesForAddress
// always pins the showcase permit and every co-located layer resolves.
export const SHOWCASE_ADDRESSES: Showcase[] = [
  { key: "sc1", address: "1500 rue Wellington", city: "Montréal", borough: "Le Sud-Ouest", lat: 45.4795, lng: -73.5642, matricule: "SHOW-0001", intensification: "Élevée", devProject: true, roadwork: true },
  { key: "sc2", address: "4200 rue Rachel Est", city: "Montréal", borough: "Le Plateau-Mont-Royal", lat: 45.5226, lng: -73.5897, matricule: "SHOW-0002", intensification: "Élevée", heritage: "lpc" },
  { key: "sc3", address: "2200 rue Ontario Est", city: "Montréal", borough: "Ville-Marie", lat: 45.5275, lng: -73.5571, matricule: "SHOW-0003", intensification: "Moyenne", heritage: "pum2050", roadwork: true },
  { key: "sc4", address: "6000 rue Hochelaga", city: "Montréal", borough: "Mercier–Hochelaga-Maisonneuve", lat: 45.5566, lng: -73.5402, matricule: "SHOW-0004", intensification: "Moyenne", contamination: "gtc" },
  { key: "sc5", address: "1100 rue Rivard", city: "Montréal", borough: "Le Plateau-Mont-Royal", lat: 45.5118, lng: -73.5723, matricule: "SHOW-0005", intensification: "Élevée", devProject: true },
  { key: "sc6", address: "800 rue Lucien-Paiement", city: "Laval", borough: "Chomedey", lat: 45.5712, lng: -73.7256, matricule: "SHOW-0006", intensification: "Moyenne", devProject: true },
  { key: "sc7", address: "300 rue Saint-Charles Ouest", city: "Longueuil", borough: "Vieux-Longueuil", lat: 45.5301, lng: -73.5078, matricule: "SHOW-0007", intensification: "Moyenne", roadwork: true },
  { key: "sc8", address: "500 rue de la Couronne", city: "Québec", borough: "La Cité-Limoilou", lat: 46.8124, lng: -71.2231, matricule: "SHOW-0008", intensification: "Élevée", heritage: "eip" },
  { key: "sc9", address: "250 rue Belvedere Sud", city: "Sherbrooke", borough: "Jacques-Cartier", lat: 45.4019, lng: -71.8951, matricule: "SHOW-0009", intensification: "Moyenne" },
  { key: "sc10", address: "700 rue Royale", city: "Trois-Rivières", borough: "Centre-ville", lat: 46.3469, lng: -72.5481, matricule: "SHOW-0010", intensification: "Faible", devProject: true },
  { key: "sc11", address: "900 rue Eddy", city: "Gatineau", borough: "Gatineau", lat: 45.4812, lng: -75.6534, matricule: "SHOW-0011", intensification: "Moyenne" },
  { key: "sc12", address: "1200 avenue Panama", city: "Brossard", borough: "Quartier DIX30", lat: 45.4506, lng: -73.4612, matricule: "SHOW-0012", intensification: "Élevée", devProject: true, roadwork: true },
];

const INTENSITY_THRESHOLD: Record<Showcase["intensification"], number> = {
  Élevée: 80,
  Moyenne: 50,
  Faible: 25,
};

type Bag = {
  permits: Record<string, unknown>[];
  propertyUnits: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  taxes: Record<string, unknown>[];
  vacancies: Record<string, unknown>[];
  contamination: Record<string, unknown>[];
  zoningPoints: Record<string, unknown>[];
  zoningPolygons: Record<string, unknown>[];
  boroughZoning: Record<string, unknown>[];
  heritage: Record<string, unknown>[];
  devProjects: Record<string, unknown>[];
  roadworks: Record<string, unknown>[];
  contracts: Record<string, unknown>[];
  delays: Record<string, unknown>[];
  stats: Record<string, unknown>[];
  inspections: Record<string, unknown>[];
};

export function generateIntelligence(): Bag {
  const bag: Bag = {
    permits: [], propertyUnits: [], transactions: [], taxes: [], vacancies: [],
    contamination: [], zoningPoints: [], zoningPolygons: [], boroughZoning: [], heritage: [],
    devProjects: [], roadworks: [], contracts: [], delays: [], stats: [], inspections: [],
  };

  // --- Tier 1: showcase parcels, fully wired ---------------------------------
  for (const s of SHOWCASE_ADDRESSES) {
    const rng = new Rng(hashSeed(s.key));
    const land = rng.int(200, 600) * 1000;
    const building = rng.int(400, 1400) * 1000;

    bag.permits.push({
      externalId: `seed-permit-${s.key}`,
      permitNumber: `PM-2026-SHOW-${s.key}`,
      permitType: "Rénovation commerciale",
      workType: "Showcase — réaménagement",
      borough: s.borough,
      matricule: s.matricule,
      address: s.address,
      city: s.city,
      latitude: s.lat,
      longitude: s.lng,
      estimatedCost: rng.int(250, 2400) * 1000,
      issueDate: new Date(Date.now() - rng.int(5, 90) * 86_400_000),
      applicantName: "Groupe Mécanique Saint-Laurent",
      applicantContact: "showcase@zonning.ca",
      requiredRbqClasses: JSON.stringify(["1.1.1"]),
      sourceUrl: `${QC}/vmtl-permis-construction`,
    });

    bag.propertyUnits.push({
      externalId: s.matricule,
      matricule: s.matricule,
      address: s.address,
      borough: s.borough,
      landValue: land,
      buildingValue: building,
      totalValue: land + building,
      landArea: rng.int(200, 1800),
      floors: rng.int(1, 6),
      units: rng.int(1, 12),
      yearBuilt: rng.int(1920, 2015),
      sourceUrl: `${QC}/vmtl-unites-evaluation-fonciere`,
    });

    bag.transactions.push({
      externalId: `seed-txn-${s.key}`,
      matricule: s.matricule,
      address: s.address,
      borough: s.borough,
      salePrice: Math.round((land + building) * rng.float(0.85, 1.15)),
      saleDate: new Date(Date.now() - rng.int(120, 1100) * 86_400_000),
      buildingType: rng.pick(["Commercial", "Mixte", "Multi-logements", "Industriel léger"]),
      sourceUrl: `${QC}/vmtl-liste-des-transactions-immobilieres-2024`,
    });

    bag.taxes.push({
      externalId: `seed-tax-${s.key}`,
      matricule: s.matricule,
      borough: s.borough,
      taxAmount: Math.round((land + building) * 0.0095),
      year: 2026,
      sourceUrl: `${QC}/vmtl-taxes-fonciere`,
    });

    const zoneCode = `Z-${rng.int(100, 999)}`;
    const landUse = rng.pick(["Mixte (M)", "Résidentiel (H)", "Commercial (C)"]);
    bag.zoningPoints.push({
      externalId: `seed-zoning-${s.key}`,
      city: s.city,
      borough: s.borough,
      latitude: s.lat + 0.0003,
      longitude: s.lng + 0.0003,
      landUse,
      intensificationLevel: s.intensification,
      densityThreshold: INTENSITY_THRESHOLD[s.intensification] + rng.int(0, 20),
      zoneCode,
      description: `Aire d'intensification ${s.intensification.toLowerCase()} — PUM 2050`,
      sourceUrl: `${QC}/pum-2050`,
    });

    // A real zoning polygon enclosing the showcase parcel so the lookup returns
    // a *confirmed* determination (not just nearest-point) in dev.
    const geom = squarePolygon(s.lat, s.lng, 0.003);
    const bbox = geometryBBox(geom);
    bag.zoningPolygons.push({
      externalId: `seed-zpoly-${s.key}`,
      city: s.city,
      borough: s.borough,
      zoneCode,
      landUse,
      regulationUrl: `${QC}/reglement-zonage`,
      minLat: bbox.minLat,
      maxLat: bbox.maxLat,
      minLng: bbox.minLng,
      maxLng: bbox.maxLng,
      geometryJson: JSON.stringify(geom),
      sourceUrl: `${QC}/zonage`,
    });

    bag.vacancies.push({
      externalId: `seed-vac-${s.key}`,
      address: s.address,
      borough: s.borough,
      latitude: s.lat - 0.0009,
      longitude: s.lng + 0.0008,
      vacancyType: rng.pick(["Local commercial", "Bureau", "Industriel"]),
      areaSqm: rng.int(80, 1200),
      sourceUrl: `${QC}/locaux-commerciaux-vacants`,
    });

    if (s.heritage) {
      bag.heritage.push({
        externalId: `heritage-${s.heritage}-${s.key}`,
        name: `${s.heritage === "lpc" ? "Bâtiment classé" : s.heritage === "eip" ? "Ensemble d'intérêt patrimonial" : "Secteur PUM 2050"} — ${s.borough}`,
        address: s.address,
        borough: s.borough,
        latitude: s.lat + 0.0006,
        longitude: s.lng - 0.0006,
        category: s.heritage,
        status: "protégé",
        description: "Statut patrimonial — contraintes de transformation applicables.",
        sourceUrl: `${QC}/patrimoine-bati`,
      });
    }

    if (s.contamination) {
      bag.contamination.push({
        externalId: `seed-contam-${s.key}`,
        address: s.address,
        borough: s.borough,
        region: CITY_GEO[s.city]?.region,
        sourceLayer: s.contamination,
        latitude: s.lat + 0.0015,
        longitude: s.lng + 0.0015,
        status: "En surveillance",
        description: "Sol contaminé — hydrocarbures / métaux lourds.",
        sourceUrl: `${QC}/vmtl-liste-des-terrains-contamines`,
      });
    }

    if (s.roadwork) {
      bag.roadworks.push({
        externalId: `seed-road-${s.key}`,
        title: `Travaux de voirie — ${s.address}`,
        description: "Réfection de chaussée et infrastructures souterraines.",
        borough: s.borough,
        city: s.city,
        startDate: new Date(Date.now() - rng.int(10, 60) * 86_400_000),
        endDate: new Date(Date.now() + rng.int(30, 180) * 86_400_000),
        status: "en cours",
        latitude: s.lat + 0.001,
        longitude: s.lng - 0.001,
        sourceUrl: `${QC}/info-travaux`,
      });
    }

    if (s.devProject) {
      bag.devProjects.push({
        externalId: `seed-dev-${s.key}`,
        name: `Projet immobilier — ${s.borough}`,
        city: s.city,
        address: s.address,
        borough: s.borough,
        latitude: s.lat + 0.004,
        longitude: s.lng + 0.004,
        unitsPlanned: rng.int(40, 600),
        projectUrl: "https://www.zonning.ca",
        sourceUrl: `${QC}/projets-de-developpement`,
      });
    }

    if (s.city === "Montréal") {
      bag.inspections.push({
        externalId: `seed-insp-${s.key}`,
        city: "Montréal",
        address: s.address,
        violationType: rng.pick(["Salubrité", "Sécurité incendie", "Entretien façade"]),
        inspectedAt: new Date(Date.now() - rng.int(30, 400) * 86_400_000),
        sourceUrl: `${QC}/vmtl-inspections`,
      });
    }
  }

  // --- Tier 2: broad per-city scatter ---------------------------------------
  const seenZoningBorough = new Set<string>();
  for (const cityName of COVERAGE_CITY_NAMES) {
    const geo = CITY_GEO[cityName]!;
    const rng = new Rng(hashSeed(`intel:${cityName}`));

    // Zoning points (map heat + nearest-point lookups).
    for (let i = 0; i < 18; i++) {
      const { lat, lng } = scatter(geo, rng.float(-1, 1), rng.float(-1, 1));
      const lvl = rng.pick(["Élevée", "Moyenne", "Faible"] as const);
      bag.zoningPoints.push({
        externalId: `seed-zoning-${cityName}-${i}`,
        city: cityName,
        borough: rng.pick(geo.sectors),
        latitude: lat,
        longitude: lng,
        landUse: rng.pick(["Mixte (M)", "Résidentiel (H)", "Commercial (C)", "Industriel (I)"]),
        intensificationLevel: lvl,
        densityThreshold: INTENSITY_THRESHOLD[lvl],
        zoneCode: `Z-${rng.int(100, 999)}`,
        description: `Aire d'intensification ${lvl.toLowerCase()}`,
        sourceUrl: `${QC}/pum-2050`,
      });
    }

    // Contaminated sites.
    for (let i = 0; i < 6; i++) {
      const { lat, lng } = scatter(geo, rng.float(-1, 1), rng.float(-1, 1));
      bag.contamination.push({
        externalId: `seed-contam-${cityName}-${i}`,
        address: `${rng.int(100, 5000)} ${rng.pick(streetsFor(geo))}`,
        borough: rng.pick(geo.sectors),
        region: geo.region,
        sourceLayer: cityName === "Montréal" ? "mtl" : "gtc",
        latitude: lat,
        longitude: lng,
        status: rng.pick(["En surveillance", "Réhabilité", "Caractérisation en cours"]),
        description: "Sol contaminé répertorié au registre GTC.",
        sourceUrl: `${QC}/terrains-contamines`,
      });
    }

    // Heritage sites.
    for (let i = 0; i < 8; i++) {
      const { lat, lng } = scatter(geo, rng.float(-1, 1), rng.float(-1, 1));
      bag.heritage.push({
        externalId: `seed-heritage-${cityName}-${i}`,
        name: `Bâtiment patrimonial ${i + 1} — ${cityName}`,
        address: `${rng.int(100, 5000)} ${rng.pick(streetsFor(geo))}`,
        borough: rng.pick(geo.sectors),
        latitude: lat,
        longitude: lng,
        category: rng.pick(["lpc", "eip", "pum2050", "citation"]),
        status: "répertorié",
        description: "Élément du patrimoine bâti.",
        sourceUrl: `${QC}/patrimoine-bati`,
      });
    }

    // Development projects.
    for (let i = 0; i < 5; i++) {
      const { lat, lng } = scatter(geo, rng.float(-1, 1), rng.float(-1, 1));
      bag.devProjects.push({
        externalId: `seed-dev-${cityName}-${i}`,
        name: `Développement ${rng.pick(["résidentiel", "mixte", "commercial"])} — ${cityName}`,
        city: cityName,
        address: `${rng.int(100, 5000)} ${rng.pick(streetsFor(geo))}`,
        borough: rng.pick(geo.sectors),
        latitude: lat,
        longitude: lng,
        unitsPlanned: rng.int(20, 800),
        sourceUrl: `${QC}/projets-de-developpement`,
      });
    }

    // Roadworks.
    for (let i = 0; i < 7; i++) {
      const { lat, lng } = scatter(geo, rng.float(-1, 1), rng.float(-1, 1));
      bag.roadworks.push({
        externalId: `seed-road-${cityName}-${i}`,
        title: `Entrave ${i + 1} — ${cityName}`,
        description: "Travaux d'infrastructure.",
        borough: rng.pick(geo.sectors),
        city: cityName,
        startDate: new Date(Date.now() - rng.int(5, 120) * 86_400_000),
        endDate: new Date(Date.now() + rng.int(10, 200) * 86_400_000),
        status: rng.pick(["en cours", "planifié", "terminé"]),
        latitude: lat,
        longitude: lng,
        sourceUrl: `${QC}/info-travaux`,
      });
    }

    // Commercial vacancies.
    for (let i = 0; i < 6; i++) {
      const { lat, lng } = scatter(geo, rng.float(-1, 1), rng.float(-1, 1));
      bag.vacancies.push({
        externalId: `seed-vac-${cityName}-${i}`,
        address: `${rng.int(100, 5000)} ${rng.pick(streetsFor(geo))}`,
        borough: rng.pick(geo.sectors),
        latitude: lat,
        longitude: lng,
        vacancyType: rng.pick(["Local commercial", "Bureau", "Industriel"]),
        areaSqm: rng.int(60, 1500),
        sourceUrl: `${QC}/locaux-commerciaux-vacants`,
      });
    }

    // Borough/sector-level rows.
    for (const sector of geo.sectors) {
      const srng = new Rng(hashSeed(`sector:${cityName}:${sector}`));
      // BoroughZoning.borough is globally unique — sector names can repeat
      // across cities, so only emit one zoning row per distinct name.
      if (!seenZoningBorough.has(sector)) {
        seenZoningBorough.add(sector);
        bag.boroughZoning.push({
          borough: sector,
          densityZone: srng.pick(["Forte densité", "Densité moyenne", "Faible densité"]),
          maxFloors: srng.int(2, 12),
          description: `Cadre de zonage — ${sector}`,
          sourceUrl: `${QC}/zonage`,
        });
      }
      bag.delays.push({
        externalId: `seed-delay-${cityName}-${sector}`,
        borough: sector,
        phase: "Émission de permis",
        medianDays: srng.int(18, 95),
        targetDays: srng.int(20, 45),
        period: "2025-2026",
        sourceUrl: `${QC}/delais-permis`,
      });
      for (const pt of ["Résidentiel", "Commercial", "Institutionnel"]) {
        const count = srng.int(40, 720);
        bag.stats.push({
          externalId: `seed-stat-${cityName}-${sector}-${pt}`,
          borough: sector,
          permitType: pt,
          period: "2025-2026",
          permitCount: count,
          estimatedCost: count * srng.int(80, 320) * 1000,
          permitCost: srng.int(150, 900),
          sourceUrl: `${QC}/statistiques-permis`,
        });
      }
    }
  }

  // Municipal contracts referencing seeded suppliers/applicants.
  const crng = new Rng(hashSeed("contracts"));
  const SUPPLIERS = [
    "Groupe Mécanique Saint-Laurent",
    "Construction Boréal Inc.",
    "Électro-Sud Montréal",
    "Béton Laurentides",
    "Toitures Cardinal Ltée",
  ];
  for (let i = 0; i < 40; i++) {
    bag.contracts.push({
      externalId: `seed-contract-${i}`,
      supplierName: crng.pick(SUPPLIERS),
      description: "Contrat municipal octroyé de gré à gré / sur appel d'offres.",
      amount: crng.int(15, 1800) * 1000,
      service: crng.pick(["Travaux publics", "Bâtiment", "Génie", "Approvisionnement"]),
      borough: crng.pick(CITY_GEO["Montréal"]!.sectors),
      approvedAt: new Date(Date.now() - crng.int(20, 700) * 86_400_000),
      contractNumber: `CT-2026-${1000 + i}`,
      sourceUrl: `${QC}/vmtl-contrats`,
    });
  }

  return bag;
}
