import { fetchCityPermitsPaginated, type CityPermitDatasetId } from "../fetchers/city-permits";
import type { PermitRecord } from "../fetchers/permits";
import type { QuebecCkanAdapter } from "./QuebecCkanAdapter";

export type CityPermitConfig = {
  datasetId: CityPermitDatasetId;
  ckanId: string;
  city: string;
  sourceUrl: string;
  preferredFormat: string | string[];
};

/** Config-driven city permit fetch via Quebec CKAN adapter. */
export async function fetchCityPermitsViaAdapter(
  config: CityPermitConfig,
  _adapter: QuebecCkanAdapter,
  limit?: number,
  options?: { maxAgeDays?: number; minIssueDate?: Date }
): Promise<PermitRecord[]> {
  return fetchCityPermitsPaginated(config.datasetId, limit, options);
}
