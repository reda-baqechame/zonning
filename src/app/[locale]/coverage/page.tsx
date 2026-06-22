import CoverageClient from "./CoverageClient";
import { buildRuntimeTruth } from "@/lib/runtime-truth";

export const dynamic = "force-dynamic";

export default async function CoveragePage() {
  // SSR the honest coverage truth so this trust page loads with real numbers
  // immediately (per-city status, searchable vs monitored), not a client shell.
  const truth = await buildRuntimeTruth().catch(() => null);
  const initialTruth = truth
    ? {
        registeredSources: truth.registeredSources,
        indexedDatasets: truth.indexedDatasets,
        searchableMunicipalities: truth.searchableMunicipalities,
        monitoredCities: truth.monitoredCities,
        cities: truth.cities.map((c) => ({
          city: c.city,
          permitStatus: c.permitStatus,
          zoningStatus: c.zoningStatus,
        })),
      }
    : null;
  return <CoverageClient initialTruth={initialTruth} />;
}
