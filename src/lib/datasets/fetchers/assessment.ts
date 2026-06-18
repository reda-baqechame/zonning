import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { parseCsvText, pick, parseMoney, parseIntSafe } from "../parser";

export type AssessmentRecord = {
  externalId: string;
  matricule: string;
  address?: string;
  borough?: string;
  landValue?: number;
  buildingValue?: number;
  totalValue?: number;
  landArea?: number;
  floors?: number;
  units?: number;
  yearBuilt?: number;
  sourceUrl: string;
};

export async function fetchAssessments(limit?: number): Promise<AssessmentRecord[]> {
  const cap = limit ?? getSyncLimit("assessment");
  const resourceUrl = await fetchCkanResourceUrl(
    DATASETS.assessment.ckanId,
    DATASETS.assessment.preferredFormat
  );
  if (!resourceUrl) return [];

  const text = await fetchText(resourceUrl, 25_000_000);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap);
  const results: AssessmentRecord[] = [];

  for (const row of rows) {
    const matricule = pick(
      row,
      "matricule83",
      "matricule",
      "idu",
      "no_matricule",
      "id_uev"
    );
    if (!matricule) continue;

    const civic = pick(row, "civique_debut", "no_civique_debut", "nociviquedebut");
    const street = pick(row, "nom_rue", "rue", "odonyme");

    results.push({
      externalId: pick(row, "id_uev") || matricule,
      matricule,
      address: pick(row, "adresse") || `${civic} ${street}`.trim() || undefined,
      borough: pick(row, "municipalite", "arrondissement", "borough", "arrond"),
      landValue: parseMoney(
        pick(row, "valeur_terrain", "valeurterrain", "valeur_du_terrain")
      ),
      buildingValue: parseMoney(
        pick(row, "valeur_batiment", "valeurbatiment", "valeur_du_batiment")
      ),
      totalValue: parseMoney(
        pick(
          row,
          "valeur_totale",
          "valeurtotale",
          "valeur_immeuble",
          "valeur_unite",
          "valeurunite"
        )
      ),
      landArea: parseIntSafe(pick(row, "superficie_terrain", "superficieterrain")),
      floors: parseIntSafe(pick(row, "etage_hors_sol", "nombre_etages")),
      units: parseIntSafe(pick(row, "nombre_logement", "nombrelogements")),
      yearBuilt: parseIntSafe(pick(row, "annee_construction", "anneeconstruction")),
      sourceUrl: DATASETS.assessment.sourceUrl,
    });
  }

  return results;
}
