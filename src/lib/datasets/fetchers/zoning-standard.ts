import { fetchCkanResourceUrl, fetchJson, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";

export type ZoningStandardRow = {
  externalId: string;
  city?: string;
  zoneCode?: string;
  allowedUses?: string[];
  sourceUrl: string;
};

export async function fetchZoningStandard(
  opts: { limit?: number } = {},
): Promise<ZoningStandardRow[]> {
  const cfg = DATASETS["zoning-standard"];
  const limit = opts.limit ?? getSyncLimit("zoning-standard");
  try {
    const url =
      cfg.directResourceUrl ??
      (await fetchCkanResourceUrl(cfg.ckanId, ["GeoJSON", "JSON", "CSV"]));
    if (!url) return [];
    const geo = cfg.directResourceUrl
      ? await fetchJson<{ features?: { properties?: Record<string, unknown> }[] }>(url)
      : (JSON.parse((await fetchText(url)) ?? "{}") as {
          features?: { properties?: Record<string, unknown> }[];
        });
    if (!geo) return [];
    return (geo.features ?? [])
      .slice(0, limit)
      .map((f, i) => {
        const props = f.properties ?? {};
        const usages = props.usages ?? props.allowed_uses ?? props.USAGES;
        return {
          externalId: String(props.id ?? props.OBJECTID ?? `zon-${i}`),
          city:
            String(props.MUNICIPALITE ?? props.municipalite ?? props.city ?? "").trim() ||
            undefined,
          zoneCode:
            String(props.NO_ZONAGE ?? props.zone ?? props.code ?? props.zonage ?? "").trim() ||
            undefined,
          allowedUses: usages
            ? String(usages)
                .split(/[;,]/)
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
          sourceUrl: cfg.sourceUrl,
        };
      })
      .filter((r) => r.zoneCode || r.city);
  } catch {
    return [];
  }
}
