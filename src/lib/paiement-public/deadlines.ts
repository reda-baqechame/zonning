import { addDays } from "date-fns";

/** QC prompt-payment: simplified deadlines from award date (2025 regulation). */
export function computePaymentDeadlines(awardDate: Date, amount?: number | null) {
  const invoiceDue = addDays(awardDate, 30);
  const paymentDue = addDays(awardDate, 45);
  const interestStarts = addDays(paymentDue, 1);

  return {
    invoiceDue,
    paymentDue,
    interestStarts,
    notesFr:
      amount && amount > 100_000
        ? "Contrat substantiel — vérifier délais contractuels SEAO"
        : "Délais indicatifs Loi sur le paiement des contrats publics (QC)",
    notesEn:
      amount && amount > 100_000
        ? "Substantial contract — verify SEAO contractual terms"
        : "Indicative deadlines under QC public payment law",
  };
}
