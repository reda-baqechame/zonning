/**
 * ZONNING ontology — the semantic layer that turns fragmented Quebec public
 * records into a single, investigable model of construction reality.
 *
 * Inspired by Palantir's ontology (objects + links + properties + actions):
 * every entity in the platform is modeled as a typed GraphNode, every
 * relationship as a typed GraphEdge, and every claim carries Evidence so the
 * user can trace any fact back to its source record.
 *
 * Object types map 1:1 to the Prisma models that already exist, so the graph
 * is a *view* over ingested data — no duplication, no separate store.
 */

/** Every kind of entity the investigation canvas can render. */
export type ObjectType =
  | "property" // PropertyUnit (parcel / assessment)
  | "permit" // Permit
  | "tender" // Tender (SEAO)
  | "tender_award" // TenderAward (who won what)
  | "company" // Company (registre / NEQ)
  | "contractor" // resolved actor (RBQ holder / applicant / winner)
  | "rbq_license" // RbqLicense
  | "rbq_infraction" // RbqInfraction
  | "amp_authorization" // AmpAuthorization
  | "transaction" // PropertyTransaction (sale)
  | "contaminated_site" // ContaminatedSite
  | "heritage_site" // HeritageSite
  | "zoning_point" // ZoningPoint
  | "development_project" // DevelopmentProject
  | "road_work" // RoadWork
  | "municipal_contract" // MunicipalContract
  | "supplier" // MunicipalSupplier
  | "commercial_vacancy" // CommercialVacancy
  | "inspection" // MunicipalInspection
  | "tax" // PropertyTax
  | "permit_delay"; // BoroughPermitDelay

/** Typed relationships between entities. */
export type LinkType =
  | "LOCATED_AT" // a record sits on a parcel
  | "APPLIED_FOR" // a contractor filed a permit
  | "HOLDS_LICENSE" // a contractor holds an RBQ license
  | "WON" // a contractor won a tender / contract
  | "SUPPLIED_TO" // a supplier served a contract
  | "CONSTRAINED_BY" // a property is limited by contamination / heritage
  | "ZONED_BY" // a property falls under a zoning determination
  | "NEAR" // spatial proximity (roadwork, dev project, contamination)
  | "COMMITTED" // a contractor committed an infraction
  | "OWNED_BY" // a property is owned by a company (resolved via land register)
  | "RELATED_TO" // entity-resolution edge (same actor across records)
  | "TAXED_AS" // a property carries a tax record
  | "SOLD_AS"; // a property has a transaction record

/** Provenance for a single claim — the trust mechanism. No claim without a source. */
export interface Evidence {
  /** Human-readable label of the source dataset, e.g. "Permis de construction — Montréal". */
  source: string;
  /** Dataset id from the registry, when known. */
  datasetId?: string;
  /** Originating record id (Prisma row id or external id). */
  recordId?: string;
  /** Public source URL the user can open to verify. */
  sourceUrl?: string;
  /** When the source record was last fetched / synced. */
  fetchedAt?: string;
  /** Subjective 0–1 confidence for derived/inferred facts. */
  confidence?: number;
}

/** A node in the investigation graph. */
export interface GraphNode {
  id: string; // stable id: `${type}:${recordId}`
  type: ObjectType;
  label: string; // human label
  sublabel?: string; // secondary line (e.g. address, NEQ, RBQ)
  recordId: string; // originating row id
  properties: Record<string, string | number | boolean | null | undefined>;
  evidence: Evidence;
  /** Geo coordinates for map lens, when available. */
  latitude?: number;
  longitude?: number;
  /** Whether this node was the seed the user started from. */
  seed?: boolean;
}

/** A typed edge between two nodes. */
export interface GraphEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  type: LinkType;
  label: string; // human label for the relationship
  evidence?: Evidence;
}

/** A subgraph returned by the graph builder. */
export interface Subgraph {
  seed: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Entity-resolution groups: node ids that were merged into one logical actor. */
  resolutionGroups: string[][];
}

/** What the user can seed an investigation from. */
export type SeedKind = "matricule" | "address" | "neq" | "rbq" | "permit" | "company" | "tender";

export interface Seed {
  kind: SeedKind;
  value: string;
  /** Optional borough/city hint to disambiguate addresses. */
  borough?: string;
  city?: string;
}
