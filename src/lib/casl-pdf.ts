import { jsPDF } from "jspdf";

export type ComplianceCertificateData = {
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  sourceType: string;
  sourceUrl: string;
  sourceFetchedAt: Date;
  lawfulBasis: string;
  issuedBy: string;
  companyName?: string | null;
};

export function generateComplianceCertificatePdf(
  data: ComplianceCertificateData
): Uint8Array {
  const doc = new jsPDF();
  const issued = new Date();

  doc.setFontSize(18);
  doc.text("ZONNING — Certificat de conformité CASL", 20, 25);

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text("Preuve de base légale pour communication électronique commerciale (Canada)", 20, 33);

  doc.setTextColor(0);
  doc.setFontSize(11);

  let y = 50;
  const line = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 20, y);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(value, 165);
    doc.text(wrapped, 70, y);
    y += Math.max(8, wrapped.length * 6);
  };

  line("Contact:", data.contactName);
  if (data.contactEmail) line("Courriel:", data.contactEmail);
  if (data.contactPhone) line("Téléphone:", data.contactPhone);
  line("Type de source:", data.sourceType);
  line("URL source publique:", data.sourceUrl);
  line("Date collecte:", data.sourceFetchedAt.toISOString());
  line("Base légale:", data.lawfulBasis);
  line("Émis par:", data.issuedBy);
  if (data.companyName) line("Entreprise:", data.companyName);
  line("Date émission:", issued.toISOString());

  y += 10;
  doc.setFontSize(9);
  doc.setTextColor(60);
  const disclaimer =
    "Ce certificat documente que les coordonnées proviennent d'un registre public vérifiable " +
    "(permis, appel d'offres, registre des entreprises). Conformément à la LCAP (CASL), " +
    "la communication doit rester pertinente au rôle professionnel du contact et inclure " +
    "identification de l'expéditeur et mécanisme de désabonnement.";
  doc.text(doc.splitTextToSize(disclaimer, 170), 20, y);

  if (process.env.CASL_LEGAL_REVIEWED !== "true") {
    y += 20;
    doc.setTextColor(180, 0, 0);
    doc.setFontSize(8);
    doc.text(
      "AVIS: Ce modèle n'a pas encore été révisé par un avocat — LEGAL_REVIEW_PENDING",
      20,
      y
    );
    doc.setTextColor(0);
  }

  doc.setFontSize(8);
  doc.text("Généré par ZONNING — zonning.ca", 20, 280);

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
