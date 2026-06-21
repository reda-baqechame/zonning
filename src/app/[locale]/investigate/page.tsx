import InvestigationCanvasClient from "./InvestigationCanvasClient";

export const metadata = {
  title: "Investigation — ZONNING",
  description:
    "Toile d'investigation : explorez le graphe des permis, entrepreneurs, terrains et contraintes du Québec.",
};

export default function InvestigatePage() {
  return <InvestigationCanvasClient />;
}
