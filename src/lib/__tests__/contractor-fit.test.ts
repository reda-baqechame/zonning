import { describe, expect, it } from "vitest";
import { classifyContractorPermit, classifyContractorTender } from "@/lib/contractor-fit";

describe("classifyContractorTender", () => {
  it("keeps execution work strong", () => {
    const fit = classifyContractorTender({
      title: "Réfection de voirie, aqueduc et stationnement",
      category: "Travaux de construction",
    });
    expect(fit.contractorWork).toBe(true);
    expect(fit.score).toBe(100);
  });

  it("does not treat professional engineering as contractor execution", () => {
    const fit = classifyContractorTender({
      title: "Services professionnels en ingénierie pour la réfection de l'enveloppe du bâtiment",
    });
    expect(fit.contractorWork).toBe(false);
    expect(fit.level).toBe("weak");
  });

  it("rejects ecological protocol work as weak for contractors", () => {
    const fit = classifyContractorTender({
      title: "Élaboration et mise en oeuvre d'un protocole de suivi écologique",
    });
    expect(fit.contractorWork).toBe(false);
    expect(fit.score).toBeLessThan(30);
  });

  it("rejects IT work even when the title says travaux", () => {
    const fit = classifyContractorTender({
      title: "Travaux liés au développement et à l'entretien des systèmes informatiques",
    });
    expect(fit.contractorWork).toBe(false);
    expect(fit.score).toBeLessThan(30);
  });
});

describe("classifyContractorPermit", () => {
  it("keeps concrete permit work eligible", () => {
    const fit = classifyContractorPermit({
      permitType: "Excavation",
      workType: "Travaux de fondation",
    });
    expect(fit.contractorWork).toBe(true);
    expect(fit.score).toBe(100);
  });

  it("does not treat tree cutting or generic certificates as contractor opportunities", () => {
    const tree = classifyContractorPermit({
      permitType: "Permis abattage d'arbres",
    });
    const certificate = classifyContractorPermit({
      permitType: "Certificat d'autorisation",
    });

    expect(tree.contractorWork).toBe(false);
    expect(certificate.contractorWork).toBe(false);
    expect(tree.score).toBeLessThan(30);
    expect(certificate.score).toBeLessThan(30);
  });

  it("keeps a plain construction label below strong fit until scope is specific", () => {
    const fit = classifyContractorPermit({ permitType: "Construction" });
    expect(fit.contractorWork).toBe(false);
    expect(fit.score).toBeLessThan(50);
  });
});
