/**
 * Product-flow verification against a deployed ZONNING instance.
 * Complements verify-deploy.ts with user-facing API checks.
 *
 * Usage: npm run verify:product
 * Env: NEXT_PUBLIC_APP_URL, optional CRON_SECRET for auth-gated routes
 */
import { loadProdEnv } from "./load-prod-env";

loadProdEnv();

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

type Check = { name: string; run: () => Promise<boolean> };

function log(mark: string, msg: string) {
  console.log(`${mark} ${msg}`);
}

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  return { res, json, text };
}

async function main() {
  console.log("ZONNING product verification\n");
  console.log(`Target: ${base}\n`);

  let sampleSeaoUrl: string | null = null;
  const sampleMeta: { tenderTitle?: string } = {};

  const checks: Check[] = [
    {
      name: "public pages return 200",
      run: async () => {
        const paths = [
          "/fr",
          "/fr/coverage",
          "/fr/intelligence",
          "/fr/marches-qc",
          "/fr/triage",
          "/fr/login",
          "/en/coverage",
        ];
        let ok = true;
        for (const p of paths) {
          const res = await fetch(`${base}${p}`, { redirect: "manual" });
          const pass = res.status === 200 || res.status === 307;
          log(pass ? "✓" : "✗", `${res.status} GET ${p}`);
          if (!pass) ok = false;
        }
        return ok;
      },
    },
    {
      name: "feed exposes tender decisions",
      run: async () => {
        const { res, json } = await fetchJson("/api/feed?limit=40&locale=fr");
        if (!res.ok || !json || typeof json !== "object" || !Array.isArray((json as { items?: unknown }).items)) {
          log("✗", `feed ${res.status}`);
          return false;
        }
        const items = (json as { items: { kind?: string; title?: string; tender?: { sourceUrl?: string }; opportunityDossier?: { decision?: { worthPursuing?: string } } }[] }).items;
        const tenders = items.filter((i) => i.kind === "tender");
        const withDecision = tenders.filter((t) => t.opportunityDossier?.decision?.worthPursuing);
        log("✓", `feed tenders=${tenders.length} withDecision=${withDecision.length}`);
        const first = tenders[0];
        if (first?.tender?.sourceUrl?.includes("seao")) {
          sampleSeaoUrl = first.tender.sourceUrl;
          sampleMeta.tenderTitle = first.title;
        }
        return tenders.length === 0 || withDecision.length > 0;
      },
    },
    {
      name: "SEAO gouv.qc.ca triage resolves indexed tender",
      run: async () => {
        if (!sampleSeaoUrl) {
          sampleSeaoUrl =
            "https://seao.gouv.qc.ca/avis-resultat-recherche/consulter?ItemId=b65c1ab0-3108-42dc-9850-777252c049bd";
        }
        const { res, json } = await fetchJson("/api/triage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sampleSeaoUrl, locale: "fr" }),
        });
        if (!res.ok || !json || typeof json !== "object") {
          log("✗", `triage ${res.status}`);
          return false;
        }
        const body = json as {
          source?: string;
          indexed?: boolean;
          triage?: { verdict?: string; headline?: string };
        };
        const pass =
          body.source === "seao" &&
          body.indexed === true &&
          body.triage?.verdict != null &&
          body.triage.verdict !== "verify_on_site";
        log(
          pass ? "✓" : "✗",
          `triage source=${body.source} indexed=${body.indexed} verdict=${body.triage?.verdict} url=${sampleSeaoUrl.slice(0, 70)}…`,
        );
        if (!pass && body.triage?.headline) {
          log(" ", body.triage.headline.slice(0, 120));
        }
        return pass;
      },
    },
    {
      name: "triage rejects garbage input",
      run: async () => {
        const { res, json } = await fetchJson("/api/triage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://example.com/about", locale: "fr" }),
        });
        const body = json as { triage?: { verdict?: string } } | null;
        const pass = res.ok && body?.triage?.verdict === "unknown";
        log(pass ? "✓" : "✗", `garbage triage verdict=${body?.triage?.verdict}`);
        return pass;
      },
    },
    {
      name: "auth-gated APIs return 401 when anonymous",
      run: async () => {
        const paths = ["/api/passport", "/api/proposals", "/api/vault"];
        let ok = true;
        for (const p of paths) {
          const res = await fetch(`${base}${p}`, { method: "GET" });
          const pass = res.status === 401 || res.status === 403 || res.status === 405;
          log(pass ? "✓" : "✗", `${res.status} GET ${p}`);
          if (!pass) ok = false;
        }
        return ok;
      },
    },
    {
      name: "coverage public API lists cities",
      run: async () => {
        const { res, json } = await fetchJson("/api/coverage/public");
        if (!res.ok || !json || typeof json !== "object") return false;
        const cities = (json as { cities?: unknown[] }).cities;
        const pass = Array.isArray(cities) && cities.length >= 3;
        log(pass ? "✓" : "✗", `coverage cities=${Array.isArray(cities) ? cities.length : 0}`);
        return pass;
      },
    },
    {
      name: "intelligence API responds",
      run: async () => {
        const { res, json } = await fetchJson(
          "/api/intelligence?address=1000%20Rue%20Saint-Denis&city=Montr%C3%A9al",
        );
        const body = json as { hasData?: boolean; zoning?: { zoneCode?: string } } | null;
        const pass = res.ok && body != null;
        log(
          pass ? "✓" : "✗",
          `intelligence ${res.status} hasData=${body?.hasData} zoning=${body?.zoning?.zoneCode ?? "—"}`,
        );
        return pass;
      },
    },
    {
      name: "map layer API returns points",
      run: async () => {
        const { res, json } = await fetchJson("/api/map/layer?layer=contamination&limit=10");
        const body = json as { count?: number; points?: unknown[] } | null;
        const pass = res.ok && Array.isArray(body?.points);
        log(pass ? "✓" : "✗", `map/layer contamination points=${body?.points?.length ?? 0}`);
        return pass;
      },
    },
    {
      name: "carte page returns 200",
      run: async () => {
        const res = await fetch(`${base}/fr/carte`, { redirect: "manual" });
        const pass = res.status === 200;
        log(pass ? "✓" : "✗", `${res.status} GET /fr/carte`);
        return pass;
      },
    },
  ];

  let passed = 0;
  for (const c of checks) {
    console.log(`\n— ${c.name}`);
    if (await c.run()) passed++;
  }

  console.log(`\n${passed}/${checks.length} product checks passed`);
  if (sampleMeta.tenderTitle) {
    console.log(`Sample tender: ${sampleMeta.tenderTitle.slice(0, 60)}`);
  }
  if (passed < checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
