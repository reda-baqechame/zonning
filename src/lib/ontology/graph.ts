/**
 * ZONNING ontology graph builder.
 *
 * Given a seed (matricule / address / NEQ / RBQ / permit / company), resolve a
 * subgraph across the ingested tables. This is the Palantir Gotham-style
 * "investigation": from one fact, expand the network of related entities, and
 * resolve the same real-world actor across multiple records (entity resolution).
 *
 * The graph is a *view* over Prisma models — no separate store. Every node
 * carries Evidence so the UI can render a traceable chain to the source record.
 *
 * State is instance-scoped (GraphBuilder) so concurrent requests never share
 * mutable graph state.
 */

import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/datasets/parser";
import { haversineKm } from "@/lib/datasets/geo";
import { evidenceFromRow, inferredEvidence } from "@/lib/evidence";
import type {
  GraphEdge,
  GraphNode,
  ObjectType,
  Seed,
  Subgraph,
} from "@/lib/ontology/types";

const NEARBY_KM = 0.5; // ~500m radius for spatial "NEAR" edges

function nodeId(type: ObjectType, recordId: string): string {
  return `${type}:${recordId}`;
}

function money(n: number | null | undefined): string | null {
  if (n == null) return null;
  return n.toLocaleString("fr-CA");
}

/** Normalize a holder/applicant name for entity-resolution matching. */
function normName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type PermitRow = {
  id: string;
  permitType: string;
  workType?: string | null;
  address: string;
  borough?: string | null;
  city: string;
  estimatedCost?: number | null;
  issueDate?: Date | null;
  applicantName?: string | null;
  sourceUrl: string;
  sourceFetchedAt: Date;
  latitude?: number | null;
  longitude?: number | null;
  matricule?: string | null;
  permitNumber?: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
  neq?: string | null;
  city?: string | null;
  region?: string | null;
  sector?: string | null;
  rbqNumber?: string | null;
  sourceUrl?: string | null;
};

export class GraphBuilder {
  private nodes = new Map<string, GraphNode>();
  private edges: GraphEdge[] = [];
  private resolutionGroups: string[][] = [];

  private addNode(node: GraphNode): GraphNode {
    const existing = this.nodes.get(node.id);
    if (existing) return existing;
    this.nodes.set(node.id, node);
    return node;
  }

  private addEdge(
    source: string,
    target: string,
    type: GraphEdge["type"],
    label: string,
    evidence?: GraphEdge["evidence"]
  ): void {
    const id = `${source}->${type}->${target}`;
    if (this.edges.some((e) => e.id === id)) return;
    this.edges.push({ id, source, target, type, label, evidence });
  }

  // ---- Per-entity node builders --------------------------------------------

  private permitNode(p: PermitRow): GraphNode {
    return this.addNode({
      id: nodeId("permit", p.id),
      type: "permit",
      label: `${p.permitType}${p.workType ? ` · ${p.workType}` : ""}`,
      sublabel: p.address,
      recordId: p.id,
      properties: {
        address: p.address,
        borough: p.borough,
        city: p.city,
        estimatedCost: money(p.estimatedCost),
        issueDate: p.issueDate ? p.issueDate.toISOString().slice(0, 10) : null,
        applicant: p.applicantName ?? null,
        matricule: p.matricule ?? null,
      },
      evidence: evidenceFromRow("permits", p),
      latitude: p.latitude ?? undefined,
      longitude: p.longitude ?? undefined,
    });
  }

  private companyNode(c: CompanyRow): GraphNode {
    return this.addNode({
      id: nodeId("company", c.id),
      type: "company",
      label: c.name,
      sublabel: [c.neq && `NEQ ${c.neq}`, c.rbqNumber && `RBQ ${c.rbqNumber}`]
        .filter(Boolean)
        .join(" · "),
      recordId: c.id,
      properties: {
        neq: c.neq ?? null,
        city: c.city ?? null,
        region: c.region ?? null,
        sector: c.sector ?? null,
        rbqNumber: c.rbqNumber ?? null,
      },
      evidence: evidenceFromRow("registre", { ...c, sourceFetchedAt: null }),
    });
  }

  private contractorNode(opts: {
    id: string;
    name: string;
    neq?: string | null;
    rbq?: string | null;
    source: string;
    sourceUrl?: string | null;
  }): GraphNode {
    return this.addNode({
      id: nodeId("contractor", opts.id),
      type: "contractor",
      label: opts.name,
      sublabel: [opts.neq && `NEQ ${opts.neq}`, opts.rbq && `RBQ ${opts.rbq}`]
        .filter(Boolean)
        .join(" · "),
      recordId: opts.id,
      properties: { neq: opts.neq ?? null, rbq: opts.rbq ?? null },
      evidence: inferredEvidence(`Résolution d'entité — ${opts.source}`, 0.7),
    });
  }

  private propertyNode(u: {
    id: string;
    matricule: string;
    address?: string | null;
    borough?: string | null;
    totalValue?: number | null;
    landValue?: number | null;
    buildingValue?: number | null;
    yearBuilt?: number | null;
    units?: number | null;
    floors?: number | null;
    sourceUrl: string;
    sourceFetchedAt: Date;
  }): GraphNode {
    return this.addNode({
      id: nodeId("property", u.id),
      type: "property",
      label: `Matricule ${u.matricule}`,
      sublabel: u.address ?? u.borough ?? undefined,
      recordId: u.id,
      properties: {
        matricule: u.matricule,
        address: u.address ?? null,
        borough: u.borough ?? null,
        totalValue: money(u.totalValue),
        landValue: money(u.landValue),
        buildingValue: money(u.buildingValue),
        yearBuilt: u.yearBuilt ?? null,
        units: u.units ?? null,
        floors: u.floors ?? null,
      },
      evidence: evidenceFromRow("assessment", u),
    });
  }

  // ---- Seed resolution ------------------------------------------------------

  private async resolveSeed(seed: Seed): Promise<GraphNode | null> {
    const v = seed.value.trim();
    if (!v) return null;

    switch (seed.kind) {
      case "matricule": {
        const unit = await prisma.propertyUnit.findUnique({ where: { matricule: v } });
        if (!unit) return null;
        const n = this.propertyNode({
          ...unit,
          sourceUrl: unit.sourceUrl,
          sourceFetchedAt: unit.sourceFetchedAt,
        });
        n.seed = true;
        return n;
      }
      case "permit": {
        const p = (await prisma.permit.findFirst({
          where: { OR: [{ id: v }, { permitNumber: v }, { externalId: v }] },
        })) as PermitRow | null;
        if (!p) return null;
        const n = this.permitNode({ ...p, sourceUrl: p.sourceUrl, sourceFetchedAt: p.sourceFetchedAt });
        n.seed = true;
        return n;
      }
      case "neq": {
        const c = (await prisma.company.findUnique({ where: { neq: v } })) as CompanyRow | null;
        if (!c) return null;
        const n = this.companyNode({ ...c, sourceUrl: c.sourceUrl ?? null });
        n.seed = true;
        return n;
      }
      case "rbq": {
        const lic = await prisma.rbqLicense.findUnique({ where: { licenseNumber: v } });
        if (lic) {
          const n = this.addNode({
            id: nodeId("rbq_license", lic.id),
            type: "rbq_license",
            label: `RBQ ${lic.licenseNumber}`,
            sublabel: lic.holderName ?? undefined,
            recordId: lic.id,
            properties: {
              license: lic.licenseNumber,
              subclass: lic.subclass ?? null,
              status: lic.status,
              expiry: lic.expiryDate ? lic.expiryDate.toISOString().slice(0, 10) : null,
            },
            evidence: evidenceFromRow("rbq", lic),
          });
          n.seed = true;
          return n;
        }
        const c = (await prisma.company.findFirst({ where: { rbqNumber: v } })) as CompanyRow | null;
        if (c) {
          const n = this.companyNode({ ...c, sourceUrl: c.sourceUrl ?? null });
          n.seed = true;
          return n;
        }
        return null;
      }
      case "company": {
        const c = (await prisma.company.findFirst({ where: { name: { contains: v } } })) as CompanyRow | null;
        if (c) {
          const n = this.companyNode({ ...c, sourceUrl: c.sourceUrl ?? null });
          n.seed = true;
          return n;
        }
        return null;
      }
      case "tender": {
        const t = await prisma.tender.findFirst({ where: { OR: [{ id: v }, { externalId: v }] } });
        if (!t) return null;
        const n = this.addNode({
          id: nodeId("tender", t.id),
          type: "tender",
          label: t.title,
          sublabel: [t.organization, t.region].filter(Boolean).join(" · ") || undefined,
          recordId: t.id,
          properties: {
            organization: t.organization ?? null,
            category: t.category ?? null,
            region: t.region ?? null,
            estimatedValue: money(t.estimatedValue),
            closesAt: t.closesAt ? t.closesAt.toISOString().slice(0, 10) : null,
            requiresAmp: t.requiresAmp,
          },
          evidence: evidenceFromRow("tenders", t),
        });
        n.seed = true;
        return n;
      }
      case "address": {
        const unit = await prisma.propertyUnit.findFirst({ where: { address: { contains: v } } });
        if (unit) {
          const n = this.propertyNode({
            ...unit,
            sourceUrl: unit.sourceUrl,
            sourceFetchedAt: unit.sourceFetchedAt,
          });
          n.seed = true;
          return n;
        }
        const p = (await prisma.permit.findFirst({
          where: { OR: [{ address: { contains: v } }, { address: { contains: normalizeAddress(v) } }] },
          orderBy: { issueDate: "desc" },
        })) as PermitRow | null;
        if (p) {
          const n = this.permitNode({ ...p, sourceUrl: p.sourceUrl, sourceFetchedAt: p.sourceFetchedAt });
          n.seed = true;
          return n;
        }
        return null;
      }
    }
  }

  // ---- Expansion -----------------------------------------------------------

  private async expandProperty(node: GraphNode): Promise<void> {
    const matricule = node.properties.matricule as string | undefined;
    const lat = node.latitude;
    const lng = node.longitude;

    if (matricule) {
      const permits = (await prisma.permit.findMany({
        where: { matricule },
        orderBy: { issueDate: "desc" },
        take: 25,
      })) as PermitRow[];
      for (const p of permits) {
        const pn = this.permitNode({ ...p, sourceUrl: p.sourceUrl, sourceFetchedAt: p.sourceFetchedAt });
        this.addEdge(pn.id, node.id, "LOCATED_AT", "permis sur ce terrain", pn.evidence);
        await this.linkApplicantContractor(pn, p.applicantName);
      }

      const txs = await prisma.propertyTransaction.findMany({
        where: { matricule },
        orderBy: { saleDate: "desc" },
        take: 10,
      });
      for (const tx of txs) {
        const tn = this.addNode({
          id: nodeId("transaction", tx.id),
          type: "transaction",
          label: tx.buildingType ? `Vente · ${tx.buildingType}` : "Vente immobilière",
          sublabel: tx.saleDate ? tx.saleDate.toISOString().slice(0, 10) : undefined,
          recordId: tx.id,
          properties: {
            salePrice: money(tx.salePrice),
            saleDate: tx.saleDate ? tx.saleDate.toISOString().slice(0, 10) : null,
            buildingType: tx.buildingType ?? null,
          },
          evidence: evidenceFromRow("transactions", tx),
        });
        this.addEdge(tn.id, node.id, "SOLD_AS", "vente enregistrée", tn.evidence);
      }

      const taxes = await prisma.propertyTax.findMany({
        where: { matricule },
        orderBy: { year: "desc" },
        take: 3,
      });
      for (const tx of taxes) {
        const tn = this.addNode({
          id: nodeId("tax", tx.id),
          type: "tax",
          label: `Taxe foncière ${tx.year ?? ""}`,
          sublabel: tx.borough ?? undefined,
          recordId: tx.id,
          properties: { amount: money(tx.taxAmount), year: tx.year ?? null },
          evidence: evidenceFromRow("property-tax", tx),
        });
        this.addEdge(tn.id, node.id, "TAXED_AS", "taxation", tn.evidence);
      }
    }

    if (lat && lng) await this.expandSpatial(node, lat, lng);
  }

  private async expandSpatial(node: GraphNode, lat: number, lng: number): Promise<void> {
    const contaminated = await prisma.contaminatedSite.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      take: 2000,
    });
    for (const c of contaminated) {
      if (c.latitude == null || c.longitude == null) continue;
      if (haversineKm(lat, lng, c.latitude, c.longitude) <= NEARBY_KM) {
        const cn = this.addNode({
          id: nodeId("contaminated_site", c.id),
          type: "contaminated_site",
          label: "Terrain contaminé",
          sublabel: c.address ?? c.borough ?? undefined,
          recordId: c.id,
          properties: { status: c.status ?? null, layer: c.sourceLayer, description: c.description ?? null },
          evidence: evidenceFromRow(c.sourceLayer === "gtc" ? "contamination-gtc" : "contamination", c),
          latitude: c.latitude ?? undefined,
          longitude: c.longitude ?? undefined,
        });
        this.addEdge(node.id, cn.id, "CONSTRAINED_BY", "proximité contamination", cn.evidence);
      }
    }

    const heritage = await prisma.heritageSite.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      take: 2000,
    });
    for (const h of heritage) {
      if (h.latitude == null || h.longitude == null) continue;
      if (haversineKm(lat, lng, h.latitude, h.longitude) <= NEARBY_KM) {
        const hn = this.addNode({
          id: nodeId("heritage_site", h.id),
          type: "heritage_site",
          label: h.name ?? "Site patrimonial",
          sublabel: h.address ?? h.borough ?? undefined,
          recordId: h.id,
          properties: { category: h.category ?? null, status: h.status ?? null },
          evidence: evidenceFromRow("heritage", h),
          latitude: h.latitude ?? undefined,
          longitude: h.longitude ?? undefined,
        });
        this.addEdge(node.id, hn.id, "CONSTRAINED_BY", "proximité patrimoine", hn.evidence);
      }
    }

    const roadworks = await prisma.roadWork.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      take: 2000,
    });
    for (const r of roadworks) {
      if (r.latitude == null || r.longitude == null) continue;
      if (haversineKm(lat, lng, r.latitude, r.longitude) <= NEARBY_KM) {
        const rn = this.addNode({
          id: nodeId("road_work", r.id),
          type: "road_work",
          label: r.title ?? "Travaux routiers",
          sublabel: r.borough ?? r.city ?? undefined,
          recordId: r.id,
          properties: {
            status: r.status ?? null,
            start: r.startDate ? r.startDate.toISOString().slice(0, 10) : null,
            end: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
          },
          evidence: evidenceFromRow("roadworks", r),
          latitude: r.latitude ?? undefined,
          longitude: r.longitude ?? undefined,
        });
        this.addEdge(node.id, rn.id, "NEAR", "travaux à proximité", rn.evidence);
      }
    }

    const projects = await prisma.developmentProject.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      take: 2000,
    });
    for (const d of projects) {
      if (d.latitude == null || d.longitude == null) continue;
      if (haversineKm(lat, lng, d.latitude, d.longitude) <= NEARBY_KM) {
        const dn = this.addNode({
          id: nodeId("development_project", d.id),
          type: "development_project",
          label: d.name ?? "Projet de développement",
          sublabel: d.address ?? d.city ?? undefined,
          recordId: d.id,
          properties: { units: d.unitsPlanned ?? null, city: d.city },
          evidence: evidenceFromRow("development-projects", d),
          latitude: d.latitude ?? undefined,
          longitude: d.longitude ?? undefined,
        });
        this.addEdge(node.id, dn.id, "NEAR", "projet à proximité", dn.evidence);
      }
    }
  }

  /** Resolve a permit applicant into a contractor node + expand its footprint. */
  private async linkApplicantContractor(
    permitNode_: GraphNode,
    applicantName: string | null | undefined
  ): Promise<void> {
    if (!applicantName) return;
    const norm = normName(applicantName);
    if (!norm) return;

    const company = (await prisma.company.findFirst({
      where: { name: { contains: applicantName } },
    })) as CompanyRow | null;

    const contractor = this.contractorNode({
      id: company?.id ?? `name:${norm}`,
      name: company?.name ?? applicantName,
      neq: company?.neq ?? null,
      rbq: company?.rbqNumber ?? null,
      source: company ? "Registre (NEQ)" : "Nom du demandeur",
      sourceUrl: company?.sourceUrl ?? null,
    });
    this.addEdge(contractor.id, permitNode_.id, "APPLIED_FOR", "demandeur du permis", contractor.evidence);

    if (company) {
      const cn = this.companyNode({ ...company, sourceUrl: company.sourceUrl ?? null });
      if (cn.id !== contractor.id) {
        this.addEdge(contractor.id, cn.id, "RELATED_TO", "même entité (NEQ)", contractor.evidence);
        this.resolutionGroups.push([contractor.id, cn.id]);
      }
      await this.expandContractor(contractor, company);
    } else {
      await this.expandContractorByName(contractor, norm);
    }
  }

  private async expandContractor(
    contractor: GraphNode,
    company: { id: string; name: string; neq?: string | null; rbqNumber?: string | null }
  ): Promise<void> {
    if (company.rbqNumber) {
      const lic = await prisma.rbqLicense.findUnique({ where: { licenseNumber: company.rbqNumber } });
      if (lic) {
        const ln = this.addNode({
          id: nodeId("rbq_license", lic.id),
          type: "rbq_license",
          label: `RBQ ${lic.licenseNumber}`,
          sublabel: lic.subclass ?? undefined,
          recordId: lic.id,
          properties: {
            status: lic.status,
            expiry: lic.expiryDate ? lic.expiryDate.toISOString().slice(0, 10) : null,
          },
          evidence: evidenceFromRow("rbq", lic),
        });
        this.addEdge(contractor.id, ln.id, "HOLDS_LICENSE", "détient licence RBQ", ln.evidence);
      }
      const infractions = await prisma.rbqInfraction.findMany({
        where: { licenseNumber: company.rbqNumber },
        take: 25,
      });
      for (const inf of infractions) {
        const inNode = this.addNode({
          id: nodeId("rbq_infraction", inf.id),
          type: "rbq_infraction",
          label: "Infraction RBQ",
          sublabel: inf.description ?? undefined,
          recordId: inf.id,
          properties: { date: inf.infractionDate ? inf.infractionDate.toISOString().slice(0, 10) : null },
          evidence: evidenceFromRow("rbq-infractions", inf),
        });
        this.addEdge(contractor.id, inNode.id, "COMMITTED", "infraction", inNode.evidence);
      }
    }

    const awards = await prisma.tenderAward.findMany({
      where: { winnerName: { contains: company.name } },
      take: 25,
    });
    for (const a of awards) {
      const an = this.addNode({
        id: nodeId("tender_award", a.id),
        type: "tender_award",
        label: a.title ?? "Adjudication",
        sublabel: a.buyerName ?? undefined,
        recordId: a.id,
        properties: {
          amount: money(a.awardAmount),
          date: a.awardDate ? a.awardDate.toISOString().slice(0, 10) : null,
          category: a.category ?? null,
          region: a.region ?? null,
        },
        evidence: evidenceFromRow("awards", a),
      });
      this.addEdge(contractor.id, an.id, "WON", "adjudicataire", an.evidence);
    }

    const contracts = await prisma.municipalContract.findMany({
      where: { supplierName: { contains: company.name } },
      take: 25,
    });
    for (const c of contracts) {
      const cn = this.addNode({
        id: nodeId("municipal_contract", c.id),
        type: "municipal_contract",
        label: c.description ?? "Contrat municipal",
        sublabel: c.borough ?? undefined,
        recordId: c.id,
        properties: {
          amount: money(c.amount),
          service: c.service ?? null,
          date: c.approvedAt ? c.approvedAt.toISOString().slice(0, 10) : null,
        },
        evidence: evidenceFromRow("contracts", c),
      });
      this.addEdge(contractor.id, cn.id, "WON", "contractant municipal", cn.evidence);
    }
  }

  private async expandContractorByName(contractor: GraphNode, norm: string): Promise<void> {
    const permits = (await prisma.permit.findMany({
      where: { applicantName: { not: null } },
      take: 4000,
    })) as PermitRow[];
    for (const p of permits) {
      if (!p.applicantName) continue;
      if (normName(p.applicantName) === norm) {
        const pn = this.permitNode({ ...p, sourceUrl: p.sourceUrl, sourceFetchedAt: p.sourceFetchedAt });
        this.addEdge(contractor.id, pn.id, "APPLIED_FOR", "demandeur du permis", contractor.evidence);
      }
    }
  }

  // ---- Public API ----------------------------------------------------------

  async build(seed: Seed): Promise<Subgraph | null> {
    const seedNode = await this.resolveSeed(seed);
    if (!seedNode) return null;
    this.addNode(seedNode);

    switch (seedNode.type) {
      case "property":
        await this.expandProperty(seedNode);
        break;
      case "permit": {
        const matricule = seedNode.properties.matricule as string | undefined;
        if (matricule) {
          const unit = await prisma.propertyUnit.findUnique({ where: { matricule } });
          if (unit) {
            const pn = this.propertyNode({
              ...unit,
              sourceUrl: unit.sourceUrl,
              sourceFetchedAt: unit.sourceFetchedAt,
            });
            this.addEdge(seedNode.id, pn.id, "LOCATED_AT", "permis sur ce terrain", seedNode.evidence);
            await this.expandProperty(pn);
          }
        }
        const applicant = seedNode.properties.applicant as string | undefined;
        if (applicant) await this.linkApplicantContractor(seedNode, applicant);
        break;
      }
      case "company":
      case "contractor": {
        const company = (await prisma.company.findUnique({
          where: { id: seedNode.recordId },
        })) as CompanyRow | null;
        if (company) {
          const contractor = this.contractorNode({
            id: company.id,
            name: company.name,
            neq: company.neq,
            rbq: company.rbqNumber,
            source: "Registre (NEQ)",
            sourceUrl: company.sourceUrl ?? null,
          });
          if (contractor.id !== seedNode.id) {
            this.addEdge(seedNode.id, contractor.id, "RELATED_TO", "même entité", seedNode.evidence);
          }
          await this.expandContractor(contractor, company);
        }
        break;
      }
      case "rbq_license": {
        const lic = await prisma.rbqLicense.findUnique({ where: { id: seedNode.recordId } });
        if (lic) {
          const contractor = this.contractorNode({
            id: `rbq:${lic.licenseNumber}`,
            name: lic.holderName ?? `Détenteur RBQ ${lic.licenseNumber}`,
            rbq: lic.licenseNumber,
            source: "Registre RBQ",
            sourceUrl: lic.sourceUrl,
          });
          this.addEdge(contractor.id, seedNode.id, "HOLDS_LICENSE", "détient licence", seedNode.evidence);
          const company = (await prisma.company.findFirst({
            where: { rbqNumber: lic.licenseNumber },
          })) as CompanyRow | null;
          if (company) await this.expandContractor(contractor, company);
        }
        break;
      }
      case "tender": {
        const title = seedNode.label;
        const awards = await prisma.tenderAward.findMany({
          where: { title: { contains: title } },
          take: 25,
        });
        for (const a of awards) {
          const an = this.addNode({
            id: nodeId("tender_award", a.id),
            type: "tender_award",
            label: a.title ?? "Adjudication",
            sublabel: a.winnerName ?? undefined,
            recordId: a.id,
            properties: {
              amount: money(a.awardAmount),
              winner: a.winnerName ?? null,
              date: a.awardDate ? a.awardDate.toISOString().slice(0, 10) : null,
            },
            evidence: evidenceFromRow("awards", a),
          });
          this.addEdge(seedNode.id, an.id, "WON", "adjudicataire", an.evidence);
        }
        break;
      }
      default:
        break;
    }

    return {
      seed: seedNode,
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      resolutionGroups: this.resolutionGroups,
    };
  }

  /**
   * Re-build from seed deterministically, then expand the requested node ids.
   * Used by the canvas "click to expand" — each API call is self-contained.
   */
  async expandNodes(seed: Seed, ids: string[]): Promise<Subgraph | null> {
    const subgraph = await this.build(seed);
    if (!subgraph) return null;
    for (const id of ids) {
      const node = this.nodes.get(id);
      if (!node) continue;
      if (node.type === "property") await this.expandProperty(node);
      if (node.type === "contractor" || node.type === "company") {
        const company = (await prisma.company.findUnique({
          where: { id: node.recordId },
        })) as CompanyRow | null;
        if (company) {
          const contractor = this.contractorNode({
            id: company.id,
            name: company.name,
            neq: company.neq,
            rbq: company.rbqNumber,
            source: "Registre (NEQ)",
            sourceUrl: company.sourceUrl ?? null,
          });
          await this.expandContractor(contractor, company);
        }
      }
    }
    return {
      seed: subgraph.seed,
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      resolutionGroups: this.resolutionGroups,
    };
  }
}

/** Build a subgraph from a seed. Convenience wrapper. */
export async function buildSubgraph(seed: Seed): Promise<Subgraph | null> {
  return new GraphBuilder().build(seed);
}
