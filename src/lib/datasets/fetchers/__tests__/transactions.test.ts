import { describe, expect, it } from "vitest";
import { parseTransactionRows } from "../transactions";

describe("transaction ingestion contract", () => {
  it("maps the consolidated Montreal 2023 transaction schema", () => {
    const rows = [
      {
        "cat\u00e9gorie": "Droit de pr\u00e9emption",
        "nom du contractant": "Alberto Neyra",
        description: "Acqu\u00e9rir un immeuble pour logement social.",
        "montant de la transaction": "1,630,000 $",
        arrondissement: "Villeray - Saint-Michel - Parc-Extension",
        "num\u00e9ro de d\u00e9cision/r\u00e9solution": "CE23 1601",
        "num\u00e9ro acte notari\u00e9": "28388257",
      },
    ];

    const [record] = parseTransactionRows(rows, "transactions-2023");

    expect(record).toMatchObject({
      externalId: "CE23 1601",
      borough: "Villeray - Saint-Michel - Parc-Extension",
      salePrice: 1_630_000,
      buildingType: "Droit de pr\u00e9emption",
      sourceUrl:
        "https://www.donneesquebec.ca/recherche/dataset/d50c333b-b6d7-47ed-848e-4481439c3c55",
    });
  });
});
