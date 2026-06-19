/**
 * Geographic anchors for every city in COVERAGE_CITIES. Coordinates are the
 * real downtown centroids; demo records are scattered in a small box around
 * them so maps render with believable Quebec clusters (not null-island).
 */

export type CityGeo = {
  city: string;
  region: string;
  lat: number;
  lng: number;
  /** Borough/sector names used for grouping. Montréal has real boroughs. */
  sectors: string[];
  /** Street names that read as authentically Québécois. */
  streets: string[];
};

const SHARED_STREETS = [
  "rue Principale",
  "boulevard des Laurentides",
  "rue Notre-Dame",
  "avenue du Parc",
  "rue Saint-Joseph",
  "boulevard Industriel",
  "rue de l'Église",
  "chemin du Lac",
  "rue Sainte-Catherine",
  "boulevard Cartier",
];

export const CITY_GEO: Record<string, CityGeo> = {
  Montréal: {
    city: "Montréal",
    region: "Montréal",
    lat: 45.5019,
    lng: -73.5674,
    sectors: [
      "Ville-Marie",
      "Le Plateau-Mont-Royal",
      "Rosemont–La Petite-Patrie",
      "Mercier–Hochelaga-Maisonneuve",
      "Villeray–Saint-Michel–Parc-Extension",
      "Ahuntsic-Cartierville",
      "Le Sud-Ouest",
      "Côte-des-Neiges–Notre-Dame-de-Grâce",
    ],
    streets: [
      "rue Sainte-Catherine",
      "boulevard Saint-Laurent",
      "avenue du Mont-Royal",
      "rue Sherbrooke",
      "rue Notre-Dame",
      "boulevard René-Lévesque",
      "rue Saint-Denis",
      "avenue du Parc",
    ],
  },
  Laval: {
    city: "Laval",
    region: "Laval",
    lat: 45.6066,
    lng: -73.7124,
    sectors: ["Chomedey", "Sainte-Rose", "Vimont", "Laval-des-Rapides", "Duvernay"],
    streets: ["boulevard Cartier", "boulevard des Laurentides", "boulevard Saint-Martin", "boulevard Curé-Labelle"],
  },
  Longueuil: {
    city: "Longueuil",
    region: "Montérégie",
    lat: 45.5312,
    lng: -73.5181,
    sectors: ["Vieux-Longueuil", "Saint-Hubert", "Greenfield Park"],
    streets: ["boulevard Taschereau", "chemin de Chambly", "boulevard Roland-Therrien"],
  },
  Québec: {
    city: "Québec",
    region: "Capitale-Nationale",
    lat: 46.8139,
    lng: -71.208,
    sectors: ["La Cité-Limoilou", "Sainte-Foy–Sillery", "Charlesbourg", "Beauport"],
    streets: ["boulevard Charest", "Grande Allée", "rue Saint-Jean", "boulevard Laurier"],
  },
  Gatineau: {
    city: "Gatineau",
    region: "Outaouais",
    lat: 45.4765,
    lng: -75.7013,
    sectors: ["Hull", "Aylmer", "Gatineau", "Buckingham"],
    streets: ["boulevard Maloney", "boulevard Saint-Joseph", "boulevard Gréber"],
  },
  Lévis: {
    city: "Lévis",
    region: "Chaudière-Appalaches",
    lat: 46.7382,
    lng: -71.2465,
    sectors: ["Desjardins", "Les Chutes-de-la-Chaudière-Est", "Les Chutes-de-la-Chaudière-Ouest"],
    streets: ["route du Président-Kennedy", "boulevard Guillaume-Couture", "rue Saint-Georges"],
  },
  Sherbrooke: {
    city: "Sherbrooke",
    region: "Estrie",
    lat: 45.4042,
    lng: -71.8929,
    sectors: ["Jacques-Cartier", "Mont-Bellevue", "Fleurimont", "Brompton"],
    streets: ["rue King Ouest", "boulevard de Portland", "rue Galt Ouest"],
  },
  "Trois-Rivières": {
    city: "Trois-Rivières",
    region: "Mauricie",
    lat: 46.3432,
    lng: -72.5421,
    sectors: ["Centre-ville", "Cap-de-la-Madeleine", "Trois-Rivières-Ouest"],
    streets: ["boulevard des Forges", "rue Notre-Dame Centre", "boulevard Jean-XXIII"],
  },
  Saguenay: {
    city: "Saguenay",
    region: "Saguenay–Lac-Saint-Jean",
    lat: 48.4279,
    lng: -71.0686,
    sectors: ["Chicoutimi", "Jonquière", "La Baie"],
    streets: ["boulevard Talbot", "rue Racine", "boulevard du Saguenay"],
  },
  Brossard: {
    city: "Brossard",
    region: "Montérégie",
    lat: 45.4486,
    lng: -73.4659,
    sectors: ["Secteur A", "Secteur L", "Quartier DIX30"],
    streets: ["boulevard Taschereau", "boulevard du Quartier", "boulevard Marie-Victorin"],
  },
  Terrebonne: {
    city: "Terrebonne",
    region: "Lanaudière",
    lat: 45.7005,
    lng: -73.6469,
    sectors: ["Terrebonne", "Lachenaie", "La Plaine"],
    streets: ["boulevard des Seigneurs", "montée Masson", "boulevard de la Pinière"],
  },
  Repentigny: {
    city: "Repentigny",
    region: "Lanaudière",
    lat: 45.7423,
    lng: -73.4501,
    sectors: ["Repentigny", "Le Gardeur"],
    streets: ["boulevard Iberville", "boulevard Brien", "rue Notre-Dame"],
  },
  "Saint-Jean-sur-Richelieu": {
    city: "Saint-Jean-sur-Richelieu",
    region: "Montérégie",
    lat: 45.3073,
    lng: -73.2622,
    sectors: ["Saint-Jean", "Iberville", "Saint-Luc"],
    streets: ["boulevard du Séminaire", "rue Saint-Jacques", "boulevard Saint-Luc"],
  },
  Drummondville: {
    city: "Drummondville",
    region: "Centre-du-Québec",
    lat: 45.8833,
    lng: -72.4847,
    sectors: ["Centre", "Saint-Nicéphore", "Saint-Charles-de-Drummond"],
    streets: ["boulevard Saint-Joseph", "rue Lindsay", "boulevard Lemire"],
  },
  "Saint-Jérôme": {
    city: "Saint-Jérôme",
    region: "Laurentides",
    lat: 45.7805,
    lng: -74.0037,
    sectors: ["Saint-Jérôme", "Bellefeuille", "Lafontaine"],
    streets: ["boulevard Labelle", "rue de Martigny", "boulevard des Hauteurs"],
  },
  Granby: {
    city: "Granby",
    region: "Montérégie",
    lat: 45.4001,
    lng: -72.7301,
    sectors: ["Centre-ville", "Sud", "Nord"],
    streets: ["rue Principale", "boulevard Leclerc", "rue Saint-Charles"],
  },
  "Saint-Hyacinthe": {
    city: "Saint-Hyacinthe",
    region: "Montérégie",
    lat: 45.6303,
    lng: -72.9568,
    sectors: ["Centre", "Douville", "La Providence"],
    streets: ["avenue Sainte-Anne", "boulevard Laframboise", "rue des Cascades"],
  },
};

export const COVERAGE_CITY_NAMES = Object.keys(CITY_GEO);

/** Deterministic point inside a ~5 km box around a city centre. */
export function scatter(geo: CityGeo, dLat: number, dLng: number): { lat: number; lng: number } {
  return {
    lat: Math.round((geo.lat + dLat * 0.045) * 1e5) / 1e5,
    lng: Math.round((geo.lng + dLng * 0.06) * 1e5) / 1e5,
  };
}

export function streetAddress(num: number, street: string, geo: CityGeo): string {
  return `${num} ${street}, ${geo.city}`;
}

/** Falls back to shared streets if a city somehow has none. */
export function streetsFor(geo: CityGeo): string[] {
  return geo.streets.length ? geo.streets : SHARED_STREETS;
}
