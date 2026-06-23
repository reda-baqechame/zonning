"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  PageHeader,
  Input,
  Select,
  FieldLabel,
  Button,
  Skeleton,
  EmptyState,
  FadeIn,
  Badge,
} from "@/components/ui";
import { ExternalLink, Maximize2, Search, Expand, LoaderCircle } from "lucide-react";
import type {
  GraphEdge,
  GraphNode,
  ObjectType,
  SeedKind,
  Subgraph,
} from "@/lib/ontology/types";
import { confidenceBand } from "@/lib/evidence";

type RiskFactor = {
  id: string;
  label: string;
  severity: number;
  tone: "low" | "moderate" | "elevated" | "high";
  detail: string;
};
type RiskAssessment = {
  overallScore: number;
  tone: "low" | "moderate" | "elevated" | "high";
  factors: RiskFactor[];
  opportunities: RiskFactor[];
  evidenceGaps?: string[];
};

// ---- Visual language -------------------------------------------------------

const TYPE_META: Record<
  ObjectType,
  { label: string; color: string; ring: string }
> = {
  property: { label: "Terrain", color: "#2563eb", ring: "#c4d8ff" },
  permit: { label: "Permis", color: "#0a9d63", ring: "#b8ecd4" },
  tender: { label: "Appel d'offres", color: "#7c3aed", ring: "#ddd0fb" },
  tender_award: { label: "Adjudication", color: "#6d28d9", ring: "#d6c9f7" },
  company: { label: "Entreprise", color: "#0e1726", ring: "#cbd5e1" },
  contractor: { label: "Entrepreneur", color: "#b9720a", ring: "#f3d9a8" },
  rbq_license: { label: "Licence RBQ", color: "#0891b2", ring: "#b3e3ef" },
  rbq_infraction: { label: "Infraction RBQ", color: "#dc2b46", ring: "#f3c3cb" },
  amp_authorization: { label: "AMP", color: "#0d9488", ring: "#b6e3dd" },
  transaction: { label: "Vente", color: "#4f46e5", ring: "#cfc9fb" },
  contaminated_site: { label: "Terrain contaminé", color: "#dc2b46", ring: "#f3c3cb" },
  heritage_site: { label: "Patrimoine", color: "#92400e", ring: "#e6c9a8" },
  zoning_point: { label: "Zonage", color: "#475569", ring: "#cbd5e1" },
  development_project: { label: "Projet", color: "#0a9d63", ring: "#b8ecd4" },
  road_work: { label: "Travaux routiers", color: "#b9720a", ring: "#f3d9a8" },
  municipal_contract: { label: "Contrat municipal", color: "#6d28d9", ring: "#d6c9f7" },
  supplier: { label: "Fournisseur", color: "#475569", ring: "#cbd5e1" },
  commercial_vacancy: { label: "Local vacant", color: "#475569", ring: "#cbd5e1" },
  inspection: { label: "Inspection", color: "#dc2b46", ring: "#f3c3cb" },
  tax: { label: "Taxe", color: "#475569", ring: "#cbd5e1" },
  permit_delay: { label: "Délai permis", color: "#475569", ring: "#cbd5e1" },
};

const SEED_OPTIONS: { value: SeedKind; label: string; placeholder: string }[] = [
  { value: "address", label: "Adresse", placeholder: "1234 rue Saint-Denis, Montréal" },
  { value: "matricule", label: "Matricule", placeholder: "1234567" },
  { value: "rbq", label: "Licence RBQ", placeholder: "1234-5678-01" },
  { value: "neq", label: "NEQ", placeholder: "1145234567" },
  { value: "company", label: "Entreprise", placeholder: "Nom de l'entreprise" },
  { value: "permit", label: "N° permis", placeholder: "PER-2024-001" },
  { value: "tender", label: "Appel d'offres", placeholder: "id ou titre SEAO" },
];

// ---- Force simulation (dependency-free) ------------------------------------

type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number; fx?: number; fy?: number };

/** Stable 32-bit hash from a string — deterministic seeding for node placement. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function runSimulation(nodes: SimNode[], edges: GraphEdge[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  // Seed node anchored at center.
  for (const n of nodes) {
    if (n.seed) {
      n.x = cx;
      n.y = cy;
      n.fx = cx;
      n.fy = cy;
    } else if (n.x === 0 && n.y === 0) {
      const a = Math.random() * Math.PI * 2;
      const r = 120 + Math.random() * 120;
      n.x = cx + Math.cos(a) * r;
      n.y = cy + Math.sin(a) * r;
    }
  }
  const index = new Map<string, SimNode>(nodes.map((n) => [n.id, n]));
  const links = edges
    .map((e) => ({ source: index.get(e.source), target: index.get(e.target) }))
    .filter((l): l is { source: SimNode; target: SimNode } => Boolean(l.source && l.target));

  const k = 90; // ideal link length
  for (let iter = 0; iter < 320; iter++) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          // Deterministic jitter (seeded by indices) — avoids Math.random so
          // the layout is reproducible across renders.
          dx = ((i * 7 + j * 13) % 11) - 5;
          dy = ((i * 5 + j * 17) % 11) - 5;
          d2 = dx * dx + dy * dy + 0.01;
        }
        const force = 4200 / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    // Spring attraction along edges
    for (const l of links) {
      const dx = l.target.x - l.source.x;
      const dy = l.target.y - l.source.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (d - k) * 0.04;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      l.source.vx += fx;
      l.source.vy += fy;
      l.target.vx -= fx;
      l.target.vy -= fy;
    }
    // Centering + integrate
    for (const n of nodes) {
      if (n.fx != null && n.fy != null) {
        n.x = n.fx;
        n.y = n.fy;
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      n.vx += (cx - n.x) * 0.01;
      n.vy += (cy - n.y) * 0.01;
      n.vx *= 0.82;
      n.vy *= 0.82;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(40, Math.min(width - 40, n.x));
      n.y = Math.max(40, Math.min(height - 40, n.y));
    }
  }
}

// ---- Component -------------------------------------------------------------

export default function InvestigationCanvasClient() {
  const locale = useLocale() === "fr" ? "fr" : "en";
  const [kind, setKind] = useState<SeedKind>("address");
  const [value, setValue] = useState("");
  const [subgraph, setSubgraph] = useState<Subgraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expanding, setExpanding] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dims, setDims] = useState({ w: 900, h: 600 });
  const [dragId, setDragId] = useState<string | null>(null);

  const t = locale === "fr"
    ? {
        title: "Toile d'investigation",
        subtitle:
          "Semez une adresse, un matricule, une licence RBQ ou une entreprise. Explorez le graphe des permis, terrains, contraintes et acteurs du Québec — chaque fait traçable jusqu'à sa source.",
        search: "Rechercher",
        searching: "Recherche…",
        noResults: "Aucune entité trouvée",
        noResultsHint: "Essayez une adresse civique complète ou un matricule à 7 chiffres.",
        overview: "Aperçu",
        relationships: "Relations",
        evidence: "Preuves",
        source: "Source",
        recordId: "Identifiant",
        fetched: "Indexé",
        confidence: "Preuves",
        expand: "Étendre",
        expanding: "Extension…",
        properties: "Propriétés",
        legend: "Légende",
        noSelection: "Sélectionnez un nœud pour inspecter son dossier",
        noSelectionHint: "Chaque fait renvoie à l'enregistrement source qui l'établit.",
        mapLens: "Carte",
        clear: "Recommencer",
      }
    : {
        title: "Investigation canvas",
        subtitle:
          "Seed an address, matricule, RBQ license or company. Explore the graph of permits, parcels, constraints and actors across Quebec — every fact traceable to its source.",
        search: "Search",
        searching: "Searching…",
        noResults: "No entity found",
        noResultsHint: "Try a full civic address or a 7-digit matricule.",
        overview: "Overview",
        relationships: "Relationships",
        evidence: "Evidence",
        source: "Source",
        recordId: "Record id",
        fetched: "Indexed",
        confidence: "Proof",
        expand: "Expand",
        expanding: "Expanding…",
        properties: "Properties",
        legend: "Legend",
        noSelection: "Select a node to inspect its dossier",
        noSelectionHint: "Every fact links back to the source record that establishes it.",
        mapLens: "Map",
        clear: "Start over",
      };

  // Responsive canvas size.
  useEffect(() => {
    const measure = () => {
      const el = svgRef.current?.parentElement;
      if (el) setDims({ w: el.clientWidth, h: Math.max(560, el.clientHeight) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const load = useCallback(async () => {
    if (!value.trim()) return;
    setLoading(true);
    setError(null);
    setExpanded(new Set());
    try {
      const url = `/api/v2/graph?kind=${encodeURIComponent(kind)}&value=${encodeURIComponent(value.trim())}`;
      const res = await fetch(url);
      const data = (await res.json().catch(() => ({}))) as Subgraph & { error?: string };
      if (!res.ok) {
        setError(data.error ?? t.noResults);
        setSubgraph(null);
      } else if (!data.nodes?.length) {
        setError(t.noResults);
        setSubgraph(null);
      } else {
        setSubgraph(data);
        setSelectedId(data.seed.id);
      }
    } catch {
      setError(t.noResults);
      setSubgraph(null);
    } finally {
      setLoading(false);
    }
  }, [kind, value, t.noResults]);

  const expandNode = useCallback(
    async (node: GraphNode) => {
      if (!subgraph || expanded.has(node.id) || node.seed) return;
      setExpanding(node.id);
      const next = new Set(expanded);
      next.add(node.id);
      setExpanded(next);
      try {
        const url = `/api/v2/graph?kind=${encodeURIComponent(kind)}&value=${encodeURIComponent(
          value.trim()
        )}&expand=${encodeURIComponent(Array.from(next).join(","))}`;
        const res = await fetch(url);
        const data = (await res.json().catch(() => ({}))) as Subgraph;
        if (res.ok && data.nodes?.length) {
          setSubgraph(data);
        }
      } finally {
        setExpanding(null);
      }
    },
    [subgraph, expanded, kind, value]
  );

  // Build simulated positions whenever the graph changes. Initial placement is
  // deterministic (seeded from node id) so positions stay stable across
  // recomputation — no cross-render cache needed, which keeps the layout
  // render-pure and lint-clean.
  const simNodes = useMemo<SimNode[]>(() => {
    if (!subgraph) return [];
    const nodes: SimNode[] = subgraph.nodes.map((n) => {
      const seed = hashStr(n.id);
      const a = (seed % 360) * (Math.PI / 180);
      const r = 120 + ((seed >> 9) % 120);
      return {
        ...n,
        x: n.seed ? dims.w / 2 : dims.w / 2 + Math.cos(a) * r,
        y: n.seed ? dims.h / 2 : dims.h / 2 + Math.sin(a) * r,
        vx: 0,
        vy: 0,
        fx: n.seed ? dims.w / 2 : undefined,
        fy: n.seed ? dims.h / 2 : undefined,
      };
    });
    runSimulation(nodes, subgraph.edges, dims.w, dims.h);
    return nodes;
  }, [subgraph, dims]);

  const edges = subgraph?.edges ?? [];
  const selected = simNodes.find((n) => n.id === selectedId) ?? null;
  const selectedEdges = edges.filter((e) => e.source === selectedId || e.target === selectedId);

  // Drag handling
  const onPointerDown = (e: React.PointerEvent, node: SimNode) => {
    if (node.seed) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragId(node.id);
    node.fx = node.x;
    node.fy = node.y;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragId) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const node = simNodes.find((n) => n.id === dragId);
    if (!node) return;
    node.fx = e.clientX - rect.left;
    node.fy = e.clientY - rect.top;
    node.x = node.fx;
    node.y = node.fy;
    // force re-render via state tick
    setDragTick((x) => x + 1);
  };
  const onPointerUp = () => {
    if (dragId) {
      const node = simNodes.find((n) => n.id === dragId);
      if (node) {
        node.fx = undefined;
        node.fy = undefined;
      }
    }
    setDragId(null);
  };
  const [dragTick, setDragTick] = useState(0);
  void dragTick;

  const typeCounts = useMemo(() => {
    const counts = new Map<ObjectType, number>();
    simNodes.forEach((n) => counts.set(n.type, (counts.get(n.type) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [simNodes]);

  return (
    <FadeIn className="mx-auto max-w-[1400px] px-4 py-8">
      <PageHeader title={t.title} subtitle={t.subtitle} />

      {/* Search bar */}
      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="w-full sm:w-48">
          <FieldLabel htmlFor="seed-kind">Type</FieldLabel>
          <Select id="seed-kind" value={kind} onChange={(e) => setKind(e.target.value as SeedKind)}>
            {SEED_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <FieldLabel htmlFor="seed-value">{t.search}</FieldLabel>
          <Input
            id="seed-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder={SEED_OPTIONS.find((o) => o.value === kind)?.placeholder}
          />
        </div>
        <Button onClick={load} disabled={loading || !value.trim()} className="sm:w-40">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? t.searching : t.search}
        </Button>
        {subgraph && (
          <Button
            variant="secondary"
            onClick={() => {
              setSubgraph(null);
              setSelectedId(null);
              setValue("");
              setExpanded(new Set());
            }}
            className="sm:w-auto"
          >
            {t.clear}
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <EmptyState title={t.noResults} description={error === t.noResults ? t.noResultsHint : error} icon={<Search className="h-8 w-8" />} />
        </div>
      )}

      {loading && !subgraph && (
        <div className="mt-6 h-[600px] w-full">
          <Skeleton className="h-full w-full" />
        </div>
      )}

      {subgraph && simNodes.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
          {/* Graph canvas */}
          <div className="relative min-h-[600px] overflow-hidden rounded-xl border border-line bg-surface-2 shadow-sm">
            <svg
              ref={svgRef}
              width={dims.w}
              height={dims.h}
              className="block h-[600px] w-full touch-none"
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              {/* Edges */}
              <g>
                {edges.map((e) => {
                  const s = simNodes.find((n) => n.id === e.source);
                  const t2 = simNodes.find((n) => n.id === e.target);
                  if (!s || !t2) return null;
                  const active = selectedId === e.source || selectedId === e.target;
                  return (
                    <line
                      key={e.id}
                      x1={s.x}
                      y1={s.y}
                      x2={t2.x}
                      y2={t2.y}
                      stroke={active ? "var(--brand)" : "var(--line-strong)"}
                      strokeWidth={active ? 2 : 1}
                      opacity={active ? 0.9 : 0.5}
                    />
                  );
                })}
              </g>
              {/* Nodes */}
              <g>
                {simNodes.map((n) => {
                  const meta = TYPE_META[n.type];
                  const isSel = n.id === selectedId;
                  const r = n.seed ? 12 : 8;
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x},${n.y})`}
                      style={{ cursor: n.seed ? "default" : "grab" }}
                      onPointerDown={(e) => onPointerDown(e, n)}
                      onClick={() => setSelectedId(n.id)}
                    >
                      {n.seed && (
                        <circle r={r + 8} fill="none" stroke={meta.color} strokeWidth={1.5} opacity={0.35}>
                          <animate attributeName="r" values={`${r + 6};${r + 12};${r + 6}`} dur="2.4s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.35;0.05;0.35" dur="2.4s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <circle
                        r={r}
                        fill={meta.color}
                        stroke={isSel ? "var(--ink)" : "#fff"}
                        strokeWidth={isSel ? 3 : 2}
                      />
                      <text
                        y={r + 13}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={isSel ? 600 : 400}
                        fill="var(--ink)"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {n.label.length > 26 ? n.label.slice(0, 24) + "…" : n.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Legend */}
            <div className="absolute left-3 top-3 rounded-lg border border-line bg-surface/95 p-2.5 shadow-1">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-subtle">{t.legend}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {typeCounts.slice(0, 8).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: TYPE_META[type].color }} />
                    {TYPE_META[type].label} ({count})
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md border border-line bg-surface/95 px-2 py-1 text-[10px] text-subtle shadow-1">
              <Maximize2 className="h-3 w-3" />
              {simNodes.length} nœuds · {edges.length} liens
            </div>
          </div>

          {/* Object View panel */}
          <div className="rounded-xl border border-line bg-surface shadow-sm">
            {selected ? (
              <ObjectView
                node={selected}
                edges={selectedEdges}
                nodes={simNodes}
                t={t}
                onExpand={expandNode}
                expanded={expanded}
                expandingId={expanding}
              />
            ) : (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 p-8 text-center">
                <Search className="h-8 w-8 text-subtle" />
                <p className="font-medium text-ink">{t.noSelection}</p>
                <p className="text-sm text-muted">{t.noSelectionHint}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </FadeIn>
  );
}
// ---- Object View panel -----------------------------------------------------

function ObjectView({
  node,
  edges,
  nodes,
  t,
  onExpand,
  expanded,
  expandingId,
}: {
  node: SimNode;
  edges: GraphEdge[];
  nodes: SimNode[];
  t: Record<string, string>;
  onExpand: (n: GraphNode) => void;
  expanded: Set<string>;
  expandingId: string | null;
}) {
  const meta = TYPE_META[node.type];
  const band = confidenceBand(node.evidence.confidence);
  const neighbors = edges.map((e) => {
    const otherId = e.source === node.id ? e.target : e.source;
    const other = nodes.find((n) => n.id === otherId);
    return { edge: e, other };
  });

  const propEntries = Object.entries(node.properties).filter(([, v]) => v != null && v !== "");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-line p-4">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: meta.color }} />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-subtle">{meta.label}</span>
          {node.seed && <Badge variant="primary">Seed</Badge>}
        </div>
        <h3 className="mt-1.5 text-base font-semibold text-ink">{node.label}</h3>
        {node.sublabel && <p className="text-sm text-muted">{node.sublabel}</p>}
      </div>

      {/* Body scroll */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Properties */}
        <section className="mb-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-subtle">{t.properties}</p>
          <dl className="divide-y divide-line rounded-lg border border-line">
            {propEntries.length === 0 && (
              <div className="p-3 text-sm text-muted">—</div>
            )}
            {propEntries.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium text-ink tabular-nums">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Composite risk — the actionable verdict */}
        {(node.type === "property" || node.type === "contractor" || node.type === "company") && (
          <RiskSection key={node.id} node={node} t={t} />
        )}

        {/* Relationships */}
        <section className="mb-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-subtle">
            {t.relationships} ({neighbors.length})
          </p>
          {neighbors.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <ul className="space-y-1.5">
              {neighbors.slice(0, 40).map(({ edge, other }) => (
                <li key={edge.id} className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    {other && (
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_META[other.type].color }} />
                    )}
                    <span className="font-medium text-ink">{other?.label ?? "—"}</span>
                  </div>
                  <span className="text-subtle">{edge.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Evidence chain */}
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-subtle">{t.evidence}</p>
          <div className="rounded-lg border border-line bg-surface-2 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">{node.evidence.source}</span>
              <Badge variant={band.tone === "success" ? "success" : band.tone === "warning" ? "warning" : "error"}>
                {band.label}
              </Badge>
            </div>
            <dl className="mt-2 space-y-1 text-muted">
              {node.evidence.datasetId && (
                <div className="flex justify-between">
                  <dt>dataset</dt>
                  <dd className="text-ink">{node.evidence.datasetId}</dd>
                </div>
              )}
              {node.evidence.recordId && (
                <div className="flex justify-between">
                  <dt>{t.recordId}</dt>
                  <dd className="font-mono text-ink">{node.evidence.recordId.slice(0, 24)}</dd>
                </div>
              )}
              {node.evidence.fetchedAt && (
                <div className="flex justify-between">
                  <dt>{t.fetched}</dt>
                  <dd className="text-ink">{new Date(node.evidence.fetchedAt).toLocaleDateString("fr-CA")}</dd>
                </div>
              )}
              {node.evidence.confidence != null && (
                <div className="flex justify-between">
                  <dt>{t.confidence}</dt>
                  <dd className="text-ink">{Math.round(node.evidence.confidence * 100)}%</dd>
                </div>
              )}
            </dl>
            {node.evidence.sourceUrl && (
              <a
                href={node.evidence.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-brand hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Source publique
              </a>
            )}
          </div>
        </section>
      </div>

      {/* Expand action */}
      {!node.seed && (
        <div className="border-t border-line p-3">
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={expanded.has(node.id) || expandingId === node.id}
            onClick={() => onExpand(node)}
          >
            {expandingId === node.id ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Expand className="h-4 w-4" />
            )}
            {expandingId === node.id ? t.expanding : expanded.has(node.id) ? "✓ " + t.expand : t.expand}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- Composite risk panel --------------------------------------------------

function toneColor(tone: RiskAssessment["tone"]): string {
  switch (tone) {
    case "high":
      return "var(--danger)";
    case "elevated":
      return "var(--warning)";
    case "moderate":
      return "var(--warning)";
    default:
      return "var(--success)";
  }
}

function toneLabel(tone: RiskAssessment["tone"], fr: boolean): string {
  const frMap = { low: "Faible", moderate: "Modéré", elevated: "Élevé", high: "Élevé" };
  const enMap = { low: "Low", moderate: "Moderate", elevated: "Elevated", high: "High" };
  return (fr ? frMap : enMap)[tone];
}

function RiskSection({ node, t }: { node: SimNode; t: Record<string, string> }) {
  // Keyed by node.id at the call site, so this remounts on selection change —
  // initial state (risk=null, loading=…) is fresh per node, no synchronous resets.
  const hasQuery = Boolean(node.properties.matricule || node.properties.rbq);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(hasQuery);

  useEffect(() => {
    let cancelled = false;
    const matricule = node.properties.matricule as string | undefined;
    const rbq = node.properties.rbq as string | undefined;
    const url = matricule
      ? `/api/v2/risk?kind=property&matricule=${encodeURIComponent(matricule)}`
      : rbq
        ? `/api/v2/risk?kind=contractor&by=rbq&value=${encodeURIComponent(rbq)}`
        : null;
    if (!url) return;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && typeof d.overallScore === "number") setRisk(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [node.id, node.properties.matricule, node.properties.rbq]);

  const fr = t.title.startsWith("Toile");

  return (
    <section className="mb-5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-subtle">
        {fr ? "Évaluation du risque" : "Risk assessment"}
      </p>
      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : !risk ? (
        <p className="text-sm text-muted">—</p>
      ) : (
        <div className="rounded-lg border border-line bg-surface-2 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white"
                style={{ background: toneColor(risk.tone) }}
              >
                {risk.overallScore}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{toneLabel(risk.tone, fr)}</p>
                <p className="text-[11px] text-subtle">{fr ? "niveau 0-100" : "level 0-100"}</p>
              </div>
            </div>
          </div>

          {risk.factors.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {risk.factors.slice(0, 6).map((f) => (
                <li key={f.id} className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">{f.label}</span>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                      style={{ background: toneColor(f.tone) }}
                    >
                      {f.severity}
                    </span>
                  </div>
                  <p className="mt-0.5 text-subtle">{f.detail}</p>
                </li>
              ))}
            </ul>
          )}

          {risk.opportunities.length > 0 && (
            <>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-success-ink">
                {fr ? "Signaux d'opportunité" : "Opportunity signals"}
              </p>
              <ul className="mt-1 space-y-1.5">
                {risk.opportunities.slice(0, 4).map((f) => (
                  <li key={f.id} className="rounded-md border border-success/30 bg-success-soft px-2.5 py-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-success-ink">{f.label}</span>
                    </div>
                    <p className="mt-0.5 text-muted">{f.detail}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {risk.evidenceGaps && risk.evidenceGaps.length > 0 && (
            <p className="mt-3 text-[10px] text-subtle">⚠ {risk.evidenceGaps[0]}</p>
          )}
        </div>
      )}
    </section>
  );
}
