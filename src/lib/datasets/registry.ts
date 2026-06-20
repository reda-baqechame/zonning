export type DatasetId =
  | "permits"
  | "permits-laval"
  | "permits-longueuil"
  | "permits-quebec"
  | "permits-gatineau"
  | "permits-levis"
  | "permit-stats"
  | "permit-delays"
  | "tenders"
  | "suppliers"
  | "transactions"
  | "transactions-2023"
  | "transactions-2025"
  | "assessment"
  | "contamination"
  | "contamination-gtc"
  | "commercial"
  | "taxes"
  | "registre"
  | "awards"
  | "zoning"
  | "pum2050-zoning"
  | "rbq"
  | "heritage"
  | "heritage-eip"
  | "heritage-lpc"
  | "pum2050-heritage"
  | "contracts"
  | "contracts-boroughs"
  | "roadworks"
  | "roadworks-saguenay"
  | "projects-sherbrooke"
  | "projects-brossard"
  | "zoning-trois-rivieres"
  | "permits-sherbrooke"
  | "permits-trois-rivieres"
  | "permits-saguenay"
  | "permits-terrebonne"
  | "permits-repentigny"
  | "permits-brossard"
  | "permits-saint-jean-richelieu"
  | "permits-drummondville"
  | "permits-saint-jerome"
  | "permits-granby"
  | "permits-saint-hyacinthe"
  | "zoning-sherbrooke"
  | "zoning-quebec"
  | "zoning-laval"
  | "zoning-longueuil"
  | "amp-registry"
  | "rbq-infractions"
  | "seao-standing-offers"
  | "inspection-violations-mtl"
  | "toronto-permits"
  | "mamh-municipal-directory"
  | "mamh-assessment-rolls"
  | "adresses-quebec"
  | "cptaq-zones"
  | "cptaq-decisions"
  | "gtc-provincial"
  | "wetlands-provincial"
  | "flood-hazards"
  | "protected-areas"
  | "road-network";

export type SyncTier = "fast" | "daily" | "weekly";

export type CkanHost = "quebec" | "montreal";

export type DatasetCoverageStatus =
  | "authoritative"
  | "partial"
  | "document_only"
  | "licensed_required"
  | "unavailable"
  | "stale";

export type DatasetConfig = {
  id: DatasetId;
  label: string;
  ckanId: string;
  sourceUrl: string;
  preferredFormat: string | string[];
  defaultLimit: number;
  productionLimit: number;
  refreshIntervalMinutes: number;
  tier: SyncTier;
  syncSource: string;
  city?: string;
  ckanHost?: CkanHost;
  directResourceUrl?: string;
  arcGisLayerUrl?: string;
  /** Datasets allowed empty at bootstrap (CKAN not live). */
  bootstrapAllowlist?: boolean;
  /** Honest coverage state. Empty or scaffold connectors must not be marketed as live. */
  coverageStatus?: DatasetCoverageStatus;
  coverageNote?: string;
  /** False when the record is a documentation/status placeholder, not a runnable source. */
  syncEnabled?: boolean;
};

export const DATASETS: Record<DatasetId, DatasetConfig> = {
  permits: {
    id: "permits",
    label: "Permis de construction (Montréal)",
    ckanId: "vmtl-permis-construction",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-permis-construction",
    preferredFormat: "CSV",
    defaultLimit: 500,
    productionLimit: 15000,
    refreshIntervalMinutes: 5,
    tier: "fast",
    syncSource: "ckan-permits",
    city: "Montréal",
  },
  "permits-laval": {
    id: "permits-laval",
    label: "Permis de construction (Laval)",
    ckanId: "permis-de-construction",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/permis-de-construction",
    preferredFormat: "CSV",
    defaultLimit: 300,
    productionLimit: 5000,
    refreshIntervalMinutes: 5,
    tier: "fast",
    syncSource: "ckan-permits-laval",
    city: "Laval",
  },
  "permits-longueuil": {
    id: "permits-longueuil",
    label: "Permis de construction (Longueuil)",
    ckanId: "permis-de-construction-ville-de-longueuil",
    sourceUrl: "https://longueuil.quebec/fr/actions/demander-un-permis",
    coverageStatus: "document_only",
    coverageNote: "The municipal permit service is linked; the former Donnees Quebec catalog identifier is unavailable and no verified machine-readable feed is configured.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 300,
    productionLimit: 3000,
    refreshIntervalMinutes: 5,
    tier: "fast",
    syncSource: "ckan-permits-longueuil",
    city: "Longueuil",
  },
  "permits-quebec": {
    id: "permits-quebec",
    label: "Permis délivrés (Ville de Québec)",
    ckanId: "permis-delivres-ville-de-quebec",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/permis-delivres-ville-de-quebec",
    preferredFormat: "CSV",
    defaultLimit: 400,
    productionLimit: 8000,
    refreshIntervalMinutes: 15,
    tier: "fast",
    syncSource: "ckan-permits-quebec",
    city: "Québec",
  },
  "permits-gatineau": {
    id: "permits-gatineau",
    label: "Permis de construction (Gatineau)",
    ckanId: "permis-de-construction-ville-de-gatineau",
    sourceUrl: "https://www.gatineau.ca/portail/default.aspx?p=guichet_municipal/permis_certificats_autorisation_urbanisme",
    coverageStatus: "document_only",
    coverageNote: "The municipal permit service is linked; the former Donnees Quebec catalog identifier is unavailable and no verified machine-readable feed is configured.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 300,
    productionLimit: 5000,
    refreshIntervalMinutes: 15,
    tier: "fast",
    syncSource: "ckan-permits-gatineau",
    city: "Gatineau",
    bootstrapAllowlist: true,
  },
  "permits-levis": {
    id: "permits-levis",
    label: "Permis de construction (Lévis)",
    ckanId: "permis-levis",
    sourceUrl: "https://www.ville.levis.qc.ca/taxes-permis-reglements/autorisations-et-demandes-de-permis/",
    coverageStatus: "document_only",
    coverageNote: "Municipal permit instructions are linked; no open machine-readable permit feed is wired yet.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 100,
    productionLimit: 3000,
    refreshIntervalMinutes: 60,
    tier: "fast",
    syncSource: "levis-permits-scaffold",
    city: "Lévis",
    bootstrapAllowlist: true,
  },
  "permit-stats": {
    id: "permit-stats",
    label: "Statistiques permis par arrondissement (Montréal)",
    ckanId: "vmtl-permis-construction",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-permis-construction",
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 500,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-permit-stats",
  },
  tenders: {
    id: "tenders",
    label: "SEAO — appels d'offres (OCDS)",
    ckanId: "systeme-electronique-dappel-doffres-seao",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/systeme-electronique-dappel-doffres-seao",
    preferredFormat: "JSON",
    defaultLimit: 300,
    productionLimit: 1000,
    refreshIntervalMinutes: 15,
    tier: "fast",
    syncSource: "ckan-tenders-ocds",
  },
  suppliers: {
    id: "suppliers",
    label: "Fournisseurs municipaux (Montréal)",
    ckanId: "vmtl-liste-des-fournisseurs",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-liste-des-fournisseurs",
    preferredFormat: "CSV",
    defaultLimit: 1000,
    productionLimit: 3000,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "ckan-suppliers",
  },
  registre: {
    id: "registre",
    label: "Registre des entreprises (Québec)",
    ckanId: "registre-des-entreprises",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/registre-des-entreprises",
    preferredFormat: ["CSV", "JSON", "ZIP"],
    defaultLimit: 500,
    productionLimit: 5000,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "ckan-registre",
  },
  rbq: {
    id: "rbq",
    label: "Licences actives RBQ (Québec entier)",
    ckanId: "licencesactives",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/licencesactives",
    preferredFormat: ["CSV", "JSON"],
    defaultLimit: 2000,
    productionLimit: 25000,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "ckan-rbq-licencesactives",
  },
  transactions: {
    id: "transactions",
    label: "Transactions immobilières 2024",
    ckanId: "d50c333b-b6d7-47ed-848e-4481439c3c55",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/d50c333b-b6d7-47ed-848e-4481439c3c55",
    preferredFormat: "CSV",
    defaultLimit: 800,
    productionLimit: 5000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-transactions",
  },
  "transactions-2023": {
    id: "transactions-2023",
    label: "Transactions immobilières 2023",
    ckanId: "d50c333b-b6d7-47ed-848e-4481439c3c55",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/d50c333b-b6d7-47ed-848e-4481439c3c55",
    preferredFormat: "CSV",
    defaultLimit: 800,
    productionLimit: 5000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-transactions-2023",
  },
  assessment: {
    id: "assessment",
    label: "Unités d'évaluation foncière",
    ckanId: "vmtl-unites-evaluation-fonciere",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-unites-evaluation-fonciere",
    preferredFormat: "CSV",
    defaultLimit: 1500,
    productionLimit: 5000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-assessment",
  },
  contamination: {
    id: "contamination",
    label: "Terrains contaminés (Montréal)",
    ckanId: "vmtl-liste-des-terrains-contamines",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-liste-des-terrains-contamines",
    preferredFormat: "JSON",
    defaultLimit: 500,
    productionLimit: 1000,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "ckan-contamination-mtl",
    city: "Montréal",
  },
  commercial: {
    id: "commercial",
    label: "Locaux commerciaux vacants",
    ckanId: "vmtl-locaux-commerciaux",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-locaux-commerciaux",
    preferredFormat: "CSV",
    defaultLimit: 500,
    productionLimit: 1500,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "ckan-commercial",
  },
  taxes: {
    id: "taxes",
    label: "Taxes municipales",
    ckanId: "vmtl-taxes-municipales",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-taxes-municipales",
    preferredFormat: "CSV",
    defaultLimit: 1000,
    productionLimit: 3000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-taxes",
  },
  awards: {
    id: "awards",
    label: "SEAO — historique des attributions",
    ckanId: "systeme-electronique-dappel-doffres-seao",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/systeme-electronique-dappel-doffres-seao",
    preferredFormat: "JSON",
    defaultLimit: 400,
    productionLimit: 1500,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "ckan-awards-ocds",
  },
  zoning: {
    id: "zoning",
    label: "Schéma d'affectation / densité (PUM legacy — caduque)",
    ckanId: "vmtl-schema-affectation-densite",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-schema-affectation-densite",
    preferredFormat: ["GeoJSON", "JSON"],
    defaultLimit: 200,
    productionLimit: 500,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-zoning-legacy",
  },
  "pum2050-zoning": {
    id: "pum2050-zoning",
    label: "PUM 2050 — intensification et affectation du sol",
    ckanId: "niveaux-intensification-urbaine-densite-affectation-sol-pum-2050",
    sourceUrl:
      "https://donnees.montreal.ca/dataset/niveaux-intensification-urbaine-densite-affectation-sol-pum-2050",
    preferredFormat: ["GeoJSON", "JSON"],
    defaultLimit: 2000,
    productionLimit: 8000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "montreal-pum2050-zoning",
    city: "Montréal",
    ckanHost: "montreal",
  },
  heritage: {
    id: "heritage",
    label: "Édifices patrimoniaux (Montréal)",
    ckanId: "vmtl-les-edifices-patrimoniaux-de-montreal",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-les-edifices-patrimoniaux-de-montreal",
    preferredFormat: "CSV",
    defaultLimit: 500,
    productionLimit: 3000,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "ckan-heritage",
  },
  "heritage-eip": {
    id: "heritage-eip",
    label: "Énoncés d'intérêt patrimonial (Montréal)",
    ckanId: "vmtl-immeubles-faisant-l-objet-d-un-enonce-d-interet-patrimonial",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-immeubles-faisant-l-objet-d-un-enonce-d-interet-patrimonial",
    preferredFormat: "GeoJSON",
    defaultLimit: 300,
    productionLimit: 1500,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "ckan-heritage-eip",
  },
  contracts: {
    id: "contracts",
    label: "Contrats municipaux (Montréal)",
    ckanId: "vmtl-contrats-octroyes-par-les-fonctionnaires-ville-centrale",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-contrats-octroyes-par-les-fonctionnaires-ville-centrale",
    preferredFormat: "CSV",
    defaultLimit: 1000,
    productionLimit: 10000,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "ckan-contracts",
  },
  roadworks: {
    id: "roadworks",
    label: "Entraves et travaux en cours (Montréal)",
    ckanId: "vmtl-info-travaux",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-info-travaux",
    preferredFormat: "CSV",
    defaultLimit: 500,
    productionLimit: 3000,
    refreshIntervalMinutes: 15,
    tier: "fast",
    syncSource: "ckan-roadworks",
    city: "Montréal",
  },
  "contamination-gtc": {
    id: "contamination-gtc",
    label: "Répertoire des terrains contaminés (GTC — provincial)",
    ckanId: "repertoire-des-terrains-contamines-gtc",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/repertoire-des-terrains-contamines-gtc",
    preferredFormat: ["GeoJSON", "JSON", "GPKG"],
    defaultLimit: 1000,
    productionLimit: 5000,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "ckan-contamination-gtc",
    directResourceUrl:
      "https://www.servicesgeo.enviroweb.gouv.qc.ca/donnees/rest/services/Public/Themes_publics/MapServer/12",
  },
  "heritage-lpc": {
    id: "heritage-lpc",
    label: "Sites et immeubles protégés LPC (Montréal)",
    ckanId: "sites-immeubles-proteges-lpc",
    sourceUrl: "https://donnees.montreal.ca/dataset/sites-immeubles-proteges-lpc",
    preferredFormat: ["GeoJSON", "JSON"],
    defaultLimit: 500,
    productionLimit: 2000,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "montreal-heritage-lpc",
    city: "Montréal",
    ckanHost: "montreal",
  },
  "pum2050-heritage": {
    id: "pum2050-heritage",
    label: "Patrimoine et paysages (PUM 2050)",
    ckanId: "patrimoine-et-paysages-plan-d-urbanisme-et-de-mobilite-2050",
    sourceUrl:
      "https://donnees.montreal.ca/dataset/patrimoine-et-paysages-plan-d-urbanisme-et-de-mobilite-2050",
    preferredFormat: ["GeoJSON", "CSV", "JSON"],
    defaultLimit: 500,
    productionLimit: 2000,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "montreal-pum2050-heritage",
    city: "Montréal",
    ckanHost: "montreal",
  },
  "permit-delays": {
    id: "permit-delays",
    label: "Délais harmonisés de délivrance de permis (Montréal)",
    ckanId: "vmtl-mesure-harmonisee-delais-delivrance-permis",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-mesure-harmonisee-delais-delivrance-permis",
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 500,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-permit-delays",
    city: "Montréal",
  },
  "transactions-2025": {
    id: "transactions-2025",
    label: "Transactions immobilières 2025",
    ckanId: "d50c333b-b6d7-47ed-848e-4481439c3c55",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/d50c333b-b6d7-47ed-848e-4481439c3c55",
    preferredFormat: "CSV",
    defaultLimit: 800,
    productionLimit: 5000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-transactions-2025",
    city: "Montréal",
    bootstrapAllowlist: true,
  },
  "projects-sherbrooke": {
    id: "projects-sherbrooke",
    label: "Projets résidentiels (Sherbrooke)",
    ckanId: "84e35108c6ff4f9f97d3b98c1aadf262_0",
    sourceUrl:
      "https://donneesouvertes-sherbrooke.opendata.arcgis.com/datasets/84e35108c6ff4f9f97d3b98c1aadf262_0",
    preferredFormat: "GeoJSON",
    defaultLimit: 200,
    productionLimit: 1000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "arcgis-sherbrooke-projects",
    city: "Sherbrooke",
    arcGisLayerUrl:
      "https://services3.arcgis.com/qsNXG7LzoUbR4c1C/arcgis/rest/services/ProjetResidentiel/FeatureServer/0",
  },
  "projects-brossard": {
    id: "projects-brossard",
    label: "Projets de construction (Brossard)",
    ckanId: "permis-brossard",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/?q=brossard+permis",
    coverageStatus: "document_only",
    coverageNote: "Search/discovery placeholder only; requires a verified municipal project feed before sync.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 100,
    productionLimit: 2000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "brossard-projects-scaffold",
    city: "Brossard",
    bootstrapAllowlist: true,
  },
  "zoning-trois-rivieres": {
    id: "zoning-trois-rivieres",
    label: "Zonage municipal (Trois-Rivières)",
    ckanId: "zonage-v3r",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/zonage-v3r",
    preferredFormat: ["GeoJSON", "CSV"],
    defaultLimit: 500,
    productionLimit: 3000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-zoning-v3r",
    city: "Trois-Rivières",
  },
  "roadworks-saguenay": {
    id: "roadworks-saguenay",
    label: "Chantiers 511 (Saguenay)",
    ckanId: "221d146e-f285-4eb4-9f47-09b4b36cc429",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/221d146e-f285-4eb4-9f47-09b4b36cc429",
    preferredFormat: ["CSV", "GeoJSON"],
    defaultLimit: 300,
    productionLimit: 1500,
    refreshIntervalMinutes: 60,
    tier: "weekly",
    syncSource: "ckan-roadworks-saguenay",
    city: "Saguenay",
  },
  "contracts-boroughs": {
    id: "contracts-boroughs",
    label: "Contrats municipaux — arrondissements (Montréal)",
    ckanId: "vmtl-contrats-octroyes-par-les-fonctionnaires-des-arrondissements",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-contrats-octroyes-par-les-fonctionnaires-des-arrondissements",
    coverageStatus: "unavailable",
    coverageNote:
      "The previously registered aggregate CKAN package returns 404. Données Québec exposes individual borough/year contract datasets, so this source needs a dedicated adapter before it can be indexed honestly.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 500,
    productionLimit: 8000,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "ckan-contracts-boroughs",
    city: "Montréal",
  },
  "permits-sherbrooke": {
    id: "permits-sherbrooke",
    label: "Permis de construction (Sherbrooke)",
    ckanId: "permis-sherbrooke",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/organization/ville-de-sherbrooke-donnees-geomatiques",
    coverageStatus: "document_only",
    coverageNote: "Municipal open-data organization discovered; permit feed still requires a verified resource URL.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 4000,
    refreshIntervalMinutes: 60,
    tier: "fast",
    syncSource: "sherbrooke-permits-scaffold",
    city: "Sherbrooke",
    bootstrapAllowlist: true,
  },
  "permits-trois-rivieres": {
    id: "permits-trois-rivieres",
    label: "Permis de construction (Trois-Rivières)",
    ckanId: "permis-trois-rivieres",
    sourceUrl: "https://www.v3r.net/services-aux-citoyens/permis-et-reglements/permis-et-certificats",
    coverageStatus: "document_only",
    coverageNote: "Corrected from the V3R zoning dataset. Only the municipal permit information page is linked until a permit feed is verified.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 3000,
    refreshIntervalMinutes: 60,
    tier: "fast",
    syncSource: "v3r-permits-scaffold",
    city: "Trois-Rivières",
    bootstrapAllowlist: true,
  },
  "permits-saguenay": {
    id: "permits-saguenay",
    label: "Permis de construction (Saguenay)",
    ckanId: "permis-saguenay",
    sourceUrl: "https://ville.saguenay.ca/services-aux-citoyens/permis-certificats-et-reglements/permis-et-certificats",
    coverageStatus: "document_only",
    coverageNote: "Corrected from the Chantiers 511 roadwork layer. Only the municipal permit information page is linked until a permit feed is verified.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 3000,
    refreshIntervalMinutes: 60,
    tier: "fast",
    syncSource: "saguenay-permits-scaffold",
    city: "Saguenay",
    bootstrapAllowlist: true,
  },
  "permits-terrebonne": {
    id: "permits-terrebonne",
    label: "Permis de construction (Terrebonne)",
    ckanId: "permis-de-construction-ville-de-terrebonne",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/?q=terrebonne+permis",
    coverageStatus: "document_only",
    coverageNote: "Search placeholder; requires verified source resource before being counted live.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 4000,
    refreshIntervalMinutes: 15,
    tier: "fast",
    syncSource: "terrebonne-permits-scaffold",
    city: "Terrebonne",
    bootstrapAllowlist: true,
  },
  "permits-repentigny": {
    id: "permits-repentigny",
    label: "Permis de construction (Repentigny)",
    ckanId: "permis-de-construction-ville-de-repentigny",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/?q=repentigny+permis",
    coverageStatus: "document_only",
    coverageNote: "Search placeholder; requires verified source resource before being counted live.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 4000,
    refreshIntervalMinutes: 15,
    tier: "fast",
    syncSource: "repentigny-permits-scaffold",
    city: "Repentigny",
    bootstrapAllowlist: true,
  },
  "permits-brossard": {
    id: "permits-brossard",
    label: "Permis de construction (Brossard)",
    ckanId: "permis-brossard",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/?q=brossard+permis",
    coverageStatus: "document_only",
    coverageNote: "Search placeholder; requires verified source resource before being counted live.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 3000,
    refreshIntervalMinutes: 15,
    tier: "fast",
    syncSource: "brossard-permits-scaffold",
    city: "Brossard",
    bootstrapAllowlist: true,
  },
  "permits-saint-jean-richelieu": {
    id: "permits-saint-jean-richelieu",
    label: "Permis de construction (Saint-Jean-sur-Richelieu)",
    ckanId: "permis-saint-jean-sur-richelieu",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/?q=saint-jean-sur-richelieu+permis",
    coverageStatus: "document_only",
    coverageNote: "Search placeholder; requires verified source resource before being counted live.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 4000,
    refreshIntervalMinutes: 15,
    tier: "fast",
    syncSource: "sjr-permits-scaffold",
    city: "Saint-Jean-sur-Richelieu",
    bootstrapAllowlist: true,
  },
  "permits-drummondville": {
    id: "permits-drummondville",
    label: "Permis de construction (Drummondville)",
    ckanId: "permis-drummondville",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/?q=drummondville+permis",
    coverageStatus: "document_only",
    coverageNote: "Search placeholder; requires verified source resource before being counted live.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 4000,
    refreshIntervalMinutes: 15,
    tier: "fast",
    syncSource: "drummondville-permits-scaffold",
    city: "Drummondville",
    bootstrapAllowlist: true,
  },
  "permits-saint-jerome": {
    id: "permits-saint-jerome",
    label: "Permis de construction (Saint-Jérôme)",
    ckanId: "permis-saint-jerome",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/?q=saint-jerome+permis",
    coverageStatus: "document_only",
    coverageNote: "Search placeholder; requires verified source resource before being counted live.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 4000,
    refreshIntervalMinutes: 15,
    tier: "fast",
    syncSource: "saint-jerome-permits-scaffold",
    city: "Saint-Jérôme",
    bootstrapAllowlist: true,
  },
  "permits-granby": {
    id: "permits-granby",
    label: "Permis de construction (Granby)",
    ckanId: "permis-granby",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/?q=granby+permis",
    coverageStatus: "document_only",
    coverageNote: "Search placeholder; requires verified source resource before being counted live.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 3000,
    refreshIntervalMinutes: 15,
    tier: "fast",
    syncSource: "granby-permits-scaffold",
    city: "Granby",
    bootstrapAllowlist: true,
  },
  "permits-saint-hyacinthe": {
    id: "permits-saint-hyacinthe",
    label: "Permis de construction (Saint-Hyacinthe)",
    ckanId: "permis-saint-hyacinthe",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/?q=saint-hyacinthe+permis",
    coverageStatus: "document_only",
    coverageNote: "Search placeholder; requires verified source resource before being counted live.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 4000,
    refreshIntervalMinutes: 15,
    tier: "fast",
    syncSource: "saint-hyacinthe-permits-scaffold",
    city: "Saint-Hyacinthe",
    bootstrapAllowlist: true,
  },
  "zoning-sherbrooke": {
    id: "zoning-sherbrooke",
    label: "Zonage (Sherbrooke)",
    ckanId: "zonage-sherbrooke",
    sourceUrl:
      "https://pab.donneesquebec.ca/recherche/organization/ville-de-sherbrooke-donnees-geomatiques",
    coverageStatus: "document_only",
    coverageNote: "Search/organization placeholder; requires verified zoning polygons or bylaw documents before being counted live.",
    syncEnabled: false,
    preferredFormat: "GeoJSON",
    defaultLimit: 500,
    productionLimit: 5000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "sherbrooke-zoning-scaffold",
    city: "Sherbrooke",
    bootstrapAllowlist: true,
  },
  "zoning-quebec": {
    id: "zoning-quebec",
    label: "Zonage (Ville de Québec)",
    ckanId: "vque_56",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vque_56",
    preferredFormat: ["GeoJSON", "CSV", "KML", "SHP"],
    defaultLimit: 500,
    productionLimit: 5000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "quebec-zoning-scaffold",
    city: "Québec",
    coverageStatus: "partial",
    coverageNote: "Official Ville de Québec zoning-zone polygons are syncable; use grids/specification sheets before any compliance conclusion.",
  },
  "zoning-laval": {
    id: "zoning-laval",
    label: "Zonage (Laval)",
    ckanId: "zonage-laval",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/?q=laval+zonage",
    coverageStatus: "document_only",
    coverageNote: "Search placeholder; requires a verified zoning polygon/regulation source before being counted live.",
    syncEnabled: false,
    preferredFormat: "GeoJSON",
    defaultLimit: 500,
    productionLimit: 5000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "laval-zoning-scaffold",
    city: "Laval",
    bootstrapAllowlist: true,
  },
  "zoning-longueuil": {
    id: "zoning-longueuil",
    label: "Zonage (Longueuil)",
    ckanId: "zonage",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/zonage",
    coverageStatus: "partial",
    coverageNote: "Official Longueuil zoning polygons are syncable; regulation grids and use tables remain required before any compliance conclusion.",
    preferredFormat: ["GeoJSON", "SHP", "KML"],
    defaultLimit: 500,
    productionLimit: 5000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "longueuil-zoning-scaffold",
    city: "Longueuil",
  },
  "amp-registry": {
    id: "amp-registry",
    label: "Registre AMP (autorisation contracter)",
    ckanId: "amp-autorises",
    sourceUrl: "https://amp.quebec/",
    coverageStatus: "document_only",
    coverageNote: "Corrected from RBQ active licences. Requires an AMP-supported source before automated sync.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 500,
    productionLimit: 5000,
    refreshIntervalMinutes: 1440,
    tier: "daily",
    syncSource: "amp-registry-scaffold",
    bootstrapAllowlist: true,
  },
  "rbq-infractions": {
    id: "rbq-infractions",
    label: "Infractions RBQ",
    ckanId: "rbq-infractions",
    sourceUrl: "https://www.rbq.gouv.qc.ca/",
    coverageStatus: "document_only",
    coverageNote: "Corrected from RBQ active licences. Requires a verified infractions/sanctions source before automated sync.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 2000,
    refreshIntervalMinutes: 1440,
    tier: "daily",
    syncSource: "rbq-infractions-scaffold",
    bootstrapAllowlist: true,
  },
  "seao-standing-offers": {
    id: "seao-standing-offers",
    label: "SEAO — offres à commandes",
    ckanId: "systeme-electronique-dappel-doffres-seao",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/systeme-electronique-dappel-doffres-seao",
    preferredFormat: "JSON",
    defaultLimit: 200,
    productionLimit: 1000,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "seao-standing-scaffold",
    bootstrapAllowlist: true,
  },
  "inspection-violations-mtl": {
    id: "inspection-violations-mtl",
    label: "Infractions inspection (Montréal)",
    ckanId: "vmtl-inspections",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/vmtl-permis-construction",
    coverageStatus: "document_only",
    coverageNote: "Placeholder mapping; not counted as live until a true inspections/violations source is verified.",
    syncEnabled: false,
    preferredFormat: "CSV",
    defaultLimit: 200,
    productionLimit: 2000,
    refreshIntervalMinutes: 1440,
    tier: "daily",
    syncSource: "mtl-inspections-scaffold",
    city: "Montréal",
    bootstrapAllowlist: true,
  },
  "mamh-municipal-directory": {
    id: "mamh-municipal-directory",
    label: "MAMH municipal directory (Quebec-wide)",
    ckanId: "repertoire-des-municipalites-du-quebec",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/repertoire-des-municipalites-du-quebec",
    preferredFormat: ["CSV", "JSON"],
    defaultLimit: 1300,
    productionLimit: 1300,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-mamh-municipal-directory",
    coverageStatus: "authoritative",
    coverageNote: "Province-wide municipal foundation source registered; worker adapter required before indexed publication.",
    syncEnabled: false,
  },
  "mamh-assessment-rolls": {
    id: "mamh-assessment-rolls",
    label: "MAMH property assessment rolls (1,140 files)",
    ckanId: "roles-d-evaluation-fonciere-du-quebec",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/roles-d-evaluation-fonciere-du-quebec",
    preferredFormat: ["GPKG", "FGDB", "ZIP", "XML"],
    defaultLimit: 1140,
    productionLimit: 1140,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-mamh-assessment-rolls",
    coverageStatus: "authoritative",
    coverageNote: "Large province-wide foundation source registered; requires Railway worker/object storage ingestion.",
    syncEnabled: false,
  },
  "adresses-quebec": {
    id: "adresses-quebec",
    label: "Adresses Quebec (province-wide)",
    ckanId: "adresses-quebec",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/adresses-quebec",
    preferredFormat: ["GPKG", "SHP", "FGDB"],
    defaultLimit: 1000,
    productionLimit: 100000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-adresses-quebec",
    coverageStatus: "authoritative",
    coverageNote: "Province-wide address foundation registered; vector/geocoder adapter pending.",
    syncEnabled: false,
  },
  "cptaq-zones": {
    id: "cptaq-zones",
    label: "CPTAQ agricultural zones",
    ckanId: "zone-agricole-du-quebec",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/zone-agricole-du-quebec",
    preferredFormat: ["SHP", "WMS", "GeoJSON"],
    defaultLimit: 1000,
    productionLimit: 100000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-cptaq-zones",
    coverageStatus: "authoritative",
    coverageNote: "Province-wide constraint layer registered; spatial tile adapter pending.",
    syncEnabled: false,
  },
  "cptaq-decisions": {
    id: "cptaq-decisions",
    label: "CPTAQ decisions",
    ckanId: "decisions-de-la-cptaq",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/decisions-de-la-cptaq",
    preferredFormat: ["CSV", "JSON"],
    defaultLimit: 1000,
    productionLimit: 100000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-cptaq-decisions",
    coverageStatus: "authoritative",
    coverageNote: "Province-wide decision layer registered; normalization adapter pending.",
    syncEnabled: false,
  },
  "gtc-provincial": {
    id: "gtc-provincial",
    label: "Provincial contaminated land directory (GTC)",
    ckanId: "repertoire-des-terrains-contamines-gtc",
    sourceUrl:
      "https://www.donneesquebec.ca/recherche/dataset/repertoire-des-terrains-contamines-gtc",
    preferredFormat: ["GPKG", "FGDB", "GeoJSON"],
    defaultLimit: 1000,
    productionLimit: 100000,
    refreshIntervalMinutes: 360,
    tier: "daily",
    syncSource: "ckan-gtc-provincial-foundation",
    coverageStatus: "authoritative",
    coverageNote: "Registered as foundation alias for GTC; operational ingestion currently uses contamination-gtc.",
    syncEnabled: false,
  },
  "wetlands-provincial": {
    id: "wetlands-provincial",
    label: "Potential wetlands (province-wide)",
    ckanId: "milieux-humides-potentiels",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/milieux-humides-potentiels",
    preferredFormat: ["GPKG", "FGDB", "SHP"],
    defaultLimit: 1000,
    productionLimit: 100000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-wetlands-provincial",
    coverageStatus: "authoritative",
    coverageNote: "Province-wide environmental constraint layer registered; spatial adapter pending.",
    syncEnabled: false,
  },
  "flood-hazards": {
    id: "flood-hazards",
    label: "Flood and erosion hazard layers",
    ckanId: "zones-inondables",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/?q=zones+inondables",
    preferredFormat: ["GPKG", "SHP", "WMS", "PDF"],
    defaultLimit: 1000,
    productionLimit: 100000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-flood-hazards",
    coverageStatus: "partial",
    coverageNote: "Hazard coverage is fragmented by source and municipality; connector must expose limitations per area.",
    syncEnabled: false,
  },
  "protected-areas": {
    id: "protected-areas",
    label: "Protected areas and conservation constraints",
    ckanId: "aires-protegees",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/aires-protegees",
    preferredFormat: ["GPKG", "SHP", "WMS"],
    defaultLimit: 1000,
    productionLimit: 100000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-protected-areas",
    coverageStatus: "authoritative",
    coverageNote: "Province-wide constraint layer registered; spatial adapter pending.",
    syncEnabled: false,
  },
  "road-network": {
    id: "road-network",
    label: "Quebec road network",
    ckanId: "reseau-routier",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/?q=reseau+routier",
    preferredFormat: ["GPKG", "SHP", "WFS", "WMS"],
    defaultLimit: 1000,
    productionLimit: 100000,
    refreshIntervalMinutes: 10080,
    tier: "weekly",
    syncSource: "ckan-road-network",
    coverageStatus: "partial",
    coverageNote: "Registered for routing/context; roadwork opportunity ingestion remains separate.",
    syncEnabled: false,
  },
  "toronto-permits": {
    id: "toronto-permits",
    label: "Building permits (Toronto — EXPAND_ONTARIO)",
    ckanId: "building-permits-active",
    sourceUrl: "https://open.toronto.ca/dataset/building-permits-active/",
    preferredFormat: "CSV",
    defaultLimit: 100,
    productionLimit: 5000,
    refreshIntervalMinutes: 60,
    tier: "fast",
    syncSource: "toronto-permits-scaffold",
    city: "Toronto",
    bootstrapAllowlist: true,
  },
};

export const ALL_DATASET_IDS = Object.keys(DATASETS) as DatasetId[];

export const TIER_DATASETS: Record<SyncTier | "all", DatasetId[]> = {
  fast: [
    "permits",
    "permits-laval",
    "permits-longueuil",
    "permits-quebec",
    "permits-gatineau",
    "permits-levis",
    "permits-sherbrooke",
    "permits-trois-rivieres",
    "permits-saguenay",
    "permits-terrebonne",
    "permits-repentigny",
    "permits-brossard",
    "permits-saint-jean-richelieu",
    "permits-drummondville",
    "permits-saint-jerome",
    "permits-granby",
    "permits-saint-hyacinthe",
    "tenders",
    "roadworks",
  ],
  daily: [
    "suppliers",
    "commercial",
    "contamination",
    "contamination-gtc",
    "registre",
    "awards",
    "rbq",
    "heritage",
    "heritage-eip",
    "heritage-lpc",
    "pum2050-heritage",
    "contracts",
    "contracts-boroughs",
    "amp-registry",
    "rbq-infractions",
    "seao-standing-offers",
    "inspection-violations-mtl",
  ],
  weekly: [
    "assessment",
    "taxes",
    "transactions",
    "transactions-2023",
    "transactions-2025",
    "zoning",
    "pum2050-zoning",
    "permit-stats",
    "permit-delays",
    "projects-sherbrooke",
    "projects-brossard",
    "zoning-trois-rivieres",
    "zoning-sherbrooke",
    "zoning-quebec",
    "zoning-laval",
    "zoning-longueuil",
    "roadworks-saguenay",
    "toronto-permits",
  ],
  all: ALL_DATASET_IDS,
};

/** Cities with permit, project, or roadwork signal in the registry. */
export const COVERAGE_CITIES = [
  "Montréal",
  "Laval",
  "Longueuil",
  "Québec",
  "Gatineau",
  "Lévis",
  "Sherbrooke",
  "Trois-Rivières",
  "Saguenay",
  "Brossard",
  "Terrebonne",
  "Repentigny",
  "Saint-Jean-sur-Richelieu",
  "Drummondville",
  "Saint-Jérôme",
  "Granby",
  "Saint-Hyacinthe",
] as const;

export function getBootstrapAllowlist(): DatasetId[] {
  return ALL_DATASET_IDS.filter((id) => DATASETS[id].bootstrapAllowlist);
}

export function getDatasetCount(): number {
  return getSyncEnabledDatasetIds().length;
}

/** Datasets registered for Quebec coverage/status pages (excludes legacy caduque + optional Ontario). */
export function getRegisteredDatasetIds(): DatasetId[] {
  return ALL_DATASET_IDS.filter((id) => {
    if (id === "toronto-permits" && process.env.EXPAND_ONTARIO !== "true") {
      return false;
    }
    if (id === "zoning") {
      return false;
    }
    return true;
  });
}

export function getDatasetCoverageStatus(id: DatasetId): DatasetCoverageStatus {
  return DATASETS[id].coverageStatus ?? "authoritative";
}

export function isDatasetSyncEnabled(id: DatasetId): boolean {
  const cfg = DATASETS[id];
  const status = getDatasetCoverageStatus(id);
  if (cfg.syncEnabled === false) return false;
  if (status === "document_only" || status === "licensed_required" || status === "unavailable") {
    return false;
  }
  return getRegisteredDatasetIds().includes(id);
}

/** Backward-compatible name: only runnable/indexed datasets, not every registered source. */
export function getActiveDatasetIds(): DatasetId[] {
  return getSyncEnabledDatasetIds();
}

export function getSyncEnabledDatasetIds(): DatasetId[] {
  return getRegisteredDatasetIds().filter(isDatasetSyncEnabled);
}

export function getRegisteredSourceCount(): number {
  return getRegisteredDatasetIds().length;
}

export function getFoundationDatasetIds(): DatasetId[] {
  return getRegisteredDatasetIds().filter((id) => DATASETS[id].syncEnabled === false);
}

export function getSyncLimit(datasetId: DatasetId): number {
  const cfg = DATASETS[datasetId];
  return process.env.NODE_ENV === "production"
    ? cfg.productionLimit
    : cfg.defaultLimit;
}

export function getDatasetIdsForTier(tier: string): DatasetId[] {
  const active = new Set(getSyncEnabledDatasetIds());
  if (tier === "all") return getSyncEnabledDatasetIds();
  if (tier in TIER_DATASETS) {
    return TIER_DATASETS[tier as SyncTier].filter((id) => active.has(id));
  }
  return [];
}

/** Bilingual search aliases for PartenairesCA */
export const SEARCH_ALIASES: Record<string, string[]> = {
  camions: ["trucks", "camion", "transport"],
  trucks: ["camions", "camion"],
  acier: ["steel", "métal"],
  steel: ["acier", "métal"],
  plomberie: ["plumbing"],
  plumbing: ["plomberie"],
  électricité: ["electrical", "electricite"],
  electrical: ["électricité", "electricite"],
};

export function expandSearchTerms(query: string): string[] {
  const q = query.toLowerCase().trim();
  const terms = [q];
  for (const [key, aliases] of Object.entries(SEARCH_ALIASES)) {
    if (q.includes(key) || aliases.some((a) => q.includes(a))) {
      terms.push(key, ...aliases);
    }
  }
  return [...new Set(terms)];
}
