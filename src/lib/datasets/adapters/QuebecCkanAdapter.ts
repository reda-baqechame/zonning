import { fetchCkanResourceUrl, fetchJson, fetchText } from "../client";

export type CkanResource = {
  url: string;
  format?: string;
};

/** Wraps Données Québec CKAN resource resolution. */
export class QuebecCkanAdapter {
  async getResourceUrl(
    ckanId: string,
    preferredFormat: string | string[]
  ): Promise<string | null> {
    return fetchCkanResourceUrl(ckanId, preferredFormat);
  }

  async fetchJson<T>(url: string): Promise<T | null> {
    return fetchJson<T>(url);
  }

  async fetchText(url: string, maxBytes?: number): Promise<string | null> {
    return fetchText(url, maxBytes);
  }
}

export const quebecCkan = new QuebecCkanAdapter();
