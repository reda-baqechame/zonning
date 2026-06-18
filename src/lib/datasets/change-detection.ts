import { fetchCkanPackage, fetchCkanResourceUrl } from "./client";
import { DATASETS, type DatasetId } from "./registry";

export type SourceChangeInfo = {
  changed: boolean;
  sourceModifiedAt: Date | null;
  resourceUrl: string | null;
};

function pickNewestModified(
  resources: { last_modified?: string; url?: string }[]
): { at: Date | null; url: string | null } {
  let newest: Date | null = null;
  let url: string | null = null;

  for (const r of resources) {
    if (!r.last_modified) continue;
    const d = new Date(r.last_modified);
    if (Number.isNaN(d.getTime())) continue;
    if (!newest || d > newest) {
      newest = d;
      url = r.url ?? null;
    }
  }

  return { at: newest, url };
}

export async function getSourceChangeInfo(datasetId: DatasetId): Promise<SourceChangeInfo> {
  const cfg = DATASETS[datasetId];

  if (cfg.arcGisLayerUrl || cfg.directResourceUrl) {
    return {
      changed: false,
      sourceModifiedAt: null,
      resourceUrl: cfg.arcGisLayerUrl ?? cfg.directResourceUrl ?? null,
    };
  }

  const host = cfg.ckanHost ?? "quebec";
  const pkg = await fetchCkanPackage(cfg.ckanId, host);
  if (!pkg?.resources?.length) {
    return { changed: true, sourceModifiedAt: null, resourceUrl: null };
  }

  const formats = Array.isArray(cfg.preferredFormat)
    ? cfg.preferredFormat
    : [cfg.preferredFormat];

  const matching = pkg.resources.filter((r) => {
    const fmt = r.format?.toUpperCase() ?? "";
    return formats.some(
      (f) =>
        fmt === f.toUpperCase() ||
        r.url?.toLowerCase().endsWith(`.${f.toLowerCase()}`)
    );
  });

  const pool = matching.length > 0 ? matching : pkg.resources;
  const { at, url } = pickNewestModified(pool);
  const resourceUrl =
    url ?? (await fetchCkanResourceUrl(cfg.ckanId, cfg.preferredFormat, host));

  return {
    changed: true,
    sourceModifiedAt: at,
    resourceUrl,
  };
}

export async function checkSourceChanged(
  datasetId: DatasetId,
  storedModifiedAt: Date | null | undefined
): Promise<SourceChangeInfo & { changed: boolean }> {
  const cfg = DATASETS[datasetId];
  if (cfg.arcGisLayerUrl || cfg.directResourceUrl) {
    return {
      changed: false,
      sourceModifiedAt: storedModifiedAt ?? null,
      resourceUrl: cfg.arcGisLayerUrl ?? cfg.directResourceUrl ?? null,
    };
  }

  const info = await getSourceChangeInfo(datasetId);

  if (!info.sourceModifiedAt) {
    return { ...info, changed: true };
  }

  if (!storedModifiedAt) {
    return { ...info, changed: true };
  }

  const changed = info.sourceModifiedAt.getTime() > storedModifiedAt.getTime();
  return { ...info, changed };
}
