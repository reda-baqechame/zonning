import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { getRequiredRbqClasses } from "../src/lib/rbq";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

const MONTREAL_BOROUGHS = [
  "Ville-Marie",
  "Le Plateau-Mont-Royal",
  "Rosemont–La Petite-Patrie",
  "Mercier–Hochelaga-Maisonneuve",
  "Villeray–Saint-Michel–Parc-Extension",
  "Ahuntsic-Cartierville",
  "Laval",
  "Longueuil",
];

const PERMIT_TYPES = [
  "Rénovation commerciale",
  "Construction résidentielle",
  "Électrique",
  "Plomberie",
  "Chauffage et climatisation",
  "Maçonnerie",
  "Béton",
  "Démolition",
];

async function main() {
  await prisma.complianceRecord.deleteMany();
  await prisma.alertSubscription.deleteMany();
  await prisma.validationInterview.deleteMany();
  await prisma.conciergeRequest.deleteMany();
  await prisma.digestSubscriber.deleteMany();
  await prisma.publicContractPayment.deleteMany();
  await prisma.usageCounter.deleteMany();
  await prisma.orgMember.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.rbqLicense.deleteMany();
  await prisma.propertyTax.deleteMany();
  await prisma.commercialVacancy.deleteMany();
  await prisma.contaminatedSite.deleteMany();
  await prisma.propertyTransaction.deleteMany();
  await prisma.propertyUnit.deleteMany();
  await prisma.municipalSupplier.deleteMany();
  await prisma.permit.deleteMany();
  await prisma.tender.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("demo1234", 12);

  await prisma.user.create({
    data: {
      email: "demo@zonning.ca",
      passwordHash,
      name: "Jean Dupont",
      companyName: "Dupont Électrique Inc.",
      rbqLicenseClass: "4.1",
      rbqLicenseNumber: "1234-5678-01",
      rbqVerified: true,
      rbqVerifiedAt: new Date(),
      ampAuthorized: true,
      trades: JSON.stringify(["électrique", "commercial"]),
      regions: JSON.stringify(["Montréal", "Laval"]),
      plan: "PRO",
      onboardingComplete: true,
    },
  });

  await prisma.rbqLicense.createMany({
    data: [
      {
        licenseNumber: "1234-5678-01",
        holderName: "Dupont Électrique Inc.",
        subclass: "4.1",
        status: "active",
        sourceUrl: "https://www.rbq.gouv.qc.ca/",
      },
      {
        licenseNumber: "5678-1234-01",
        holderName: "ThermoClimat Laval",
        subclass: "6.1",
        status: "active",
        sourceUrl: "https://www.rbq.gouv.qc.ca/",
      },
      {
        licenseNumber: "9876-5432-01",
        holderName: "Électro Québec",
        subclass: "4.1",
        status: "active",
        sourceUrl: "https://www.rbq.gouv.qc.ca/",
      },
    ],
  });

  const permits = MONTREAL_BOROUGHS.flatMap((borough, bi) =>
    PERMIT_TYPES.map((permitType, pi) => {
      const estimatedCost = 50000 + bi * 12000 + pi * 8500;
      const required = getRequiredRbqClasses(permitType);
      return {
        externalId: `seed-permit-${bi}-${pi}`,
        permitNumber: `PM-${2026}-${1000 + bi * 10 + pi}`,
        permitType,
        workType: `Travaux ${permitType.toLowerCase()}`,
        borough,
        matricule: `MTR-${100000 + bi * 100 + pi}`,
        address: `${100 + bi * 50 + pi} rue Saint-${borough.split("-")[0]}`,
        latitude: 45.5 + bi * 0.01 + pi * 0.002,
        longitude: -73.57 - bi * 0.01,
        estimatedCost,
        issueDate: new Date(Date.now() - pi * 86400000 * 3),
        applicantName: `Entreprise ${borough.split("-")[0]} ${pi + 1}`,
        applicantContact: `contact${bi}${pi}@example.ca`,
        requiredRbqClasses: JSON.stringify(required),
        sourceUrl:
          "https://www.donneesquebec.ca/recherche/dataset/vmtl-permis-construction",
      };
    })
  );

  await prisma.permit.createMany({ data: permits });

  const now = Date.now();
  const tenders = Array.from({ length: 24 }, (_, i) => {
    const daysToClose = 5 + (i % 25);
    const closesAt = new Date(now + daysToClose * 86400000);
    const publishedAt = new Date(now - (30 - daysToClose) * 86400000);
    return {
      externalId: `seed-tender-${i}`,
      title: [
        "Réfection toiture école primaire",
        "Installation électrique CIUSSS",
        "Fourniture matériaux construction MTQ",
        "Entretien HVAC bâtiment municipal",
        "Rénovation plomberie centre sportif",
      ][i % 5],
      organization: ["Ville de Montréal", "MTQ", "CIUSSS Centre-Sud", "Hydro-Québec"][
        i % 4
      ],
      category: ["Construction", "Services", "Biens"][i % 3],
      region: MONTREAL_BOROUGHS[i % MONTREAL_BOROUGHS.length],
      estimatedValue: 80000 + i * 45000,
      publishedAt,
      closesAt,
      summary:
        "Appel d'offres public publié sur le SEAO. Soumission requise avant la date de clôture.",
      sourceUrl:
        "https://www.donneesquebec.ca/recherche/dataset/systeme-electronique-dappel-doffres-seao",
      status: daysToClose <= 14 ? "active" : "active",
    };
  });

  await prisma.tender.createMany({ data: tenders });

  const companies = [
    {
      name: "Acier Québec Fabrication",
      neq: "1170000001",
      city: "Montréal",
      region: "Montréal",
      sector: "Fabrication métallique",
      certifications: JSON.stringify(["ISO 9001", "COR"]),
      capabilities: JSON.stringify(["acier", "soudure", "CNC"]),
      rbqNumber: "5678-1234-01",
      sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/registre-des-entreprises",
      email: "info@acierquebec.ca",
    },
    {
      name: "ThermoClimat Laval",
      neq: "1170000002",
      city: "Laval",
      region: "Laval",
      sector: "HVAC",
      certifications: JSON.stringify(["RBQ 6.1", "COR"]),
      capabilities: JSON.stringify(["thermopompe", "commercial", "industriel"]),
      rbqNumber: "5678-1234-02",
      sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/registre-des-entreprises",
      email: "ventes@thermoclimat.ca",
    },
    {
      name: "Béton Laurentides",
      neq: "1170000003",
      city: "Saint-Jérôme",
      region: "Laurentides",
      sector: "Béton",
      certifications: JSON.stringify(["RBQ 10.1"]),
      capabilities: JSON.stringify(["béton", "fondations", "commercial"]),
      rbqNumber: "5678-1234-03",
      sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/registre-des-entreprises",
      email: "commandes@betonlaurentides.ca",
    },
    {
      name: "Électro-Sud Montréal",
      neq: "1170000004",
      city: "Montréal",
      region: "Montréal",
      sector: "Électricité",
      certifications: JSON.stringify(["RBQ 4.1", "CCQ"]),
      capabilities: JSON.stringify(["électrique", "industriel", "institutionnel"]),
      rbqNumber: "5678-1234-04",
      sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/registre-des-entreprises",
      email: "projets@electrosud.ca",
    },
    {
      name: "Logistique Nord Camions",
      neq: "1170000005",
      city: "Québec",
      region: "Capitale-Nationale",
      sector: "Transport",
      certifications: JSON.stringify(["COR", "ISO 14001"]),
      capabilities: JSON.stringify(["camions", "reefer", "flatbed", "entrepôt"]),
      sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/registre-des-entreprises",
      email: "dispatch@logistiquenord.ca",
    },
  ];

  await prisma.company.createMany({ data: companies });

  const matricules = permits.slice(0, 12).map((p) => p.matricule!);
  await prisma.propertyUnit.createMany({
    data: matricules.map((m, i) => ({
      externalId: m,
      matricule: m,
      address: permits[i].address,
      borough: permits[i].borough,
      landValue: 200000 + i * 15000,
      buildingValue: 400000 + i * 25000,
      totalValue: 600000 + i * 40000,
      yearBuilt: 1980 + (i % 30),
      units: 1 + (i % 4),
      sourceUrl:
        "https://www.donneesquebec.ca/recherche/dataset/vmtl-unites-evaluation-fonciere",
    })),
  });

  await prisma.propertyTransaction.createMany({
    data: matricules.slice(0, 6).map((m, i) => ({
      externalId: `seed-txn-${i}`,
      matricule: m,
      address: permits[i].address,
      borough: permits[i].borough,
      salePrice: 550000 + i * 80000,
      saleDate: new Date(Date.now() - i * 90 * 86400000),
      buildingType: ["Unifamilial", "Duplex", "Commercial"][i % 3],
      sourceUrl:
        "https://www.donneesquebec.ca/recherche/dataset/vmtl-liste-des-transactions-immobilieres-2024",
    })),
  });

  await prisma.contaminatedSite.createMany({
    data: [
      {
        externalId: "seed-contam-1",
        address: "5000 rue Notre-Dame Est",
        borough: "Mercier–Hochelaga-Maisonneuve",
        latitude: 45.555,
        longitude: -73.54,
        status: "En surveillance",
        description: "Sol contaminé — hydrocarbures",
        sourceUrl:
          "https://www.donneesquebec.ca/recherche/dataset/vmtl-liste-des-terrains-contamines",
      },
    ],
  });

  await prisma.municipalSupplier.createMany({
    data: [
      {
        externalId: "seed-supplier-1",
        supplierNumber: "F-10001",
        name: "Fournitures Industrielles Montréal",
        neq: "1170000099",
        borough: "Ville-Marie",
        sourceUrl:
          "https://www.donneesquebec.ca/recherche/dataset/vmtl-liste-des-fournisseurs",
      },
    ],
  });

  console.log("Seed complete: demo@zonning.ca / demo1234");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
