import { dispatchAlert } from "@/lib/alerts/dispatcher";
import { computeVerifiedRbqFit } from "@/lib/rbq-verify";
import { haversineKm } from "@/lib/datasets/geo";
import { subDays, nextThursday, isThursday, format } from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/resend";
import {
  matchesEssentielProfile,
  parseJsonArray,
} from "@/lib/usage";

export async function sendAlertEmails(): Promise<{
  sent: number;
  errors: string[];
}> {
  return sendAlertEmailsForWindow({ since: subDays(new Date(), 1) });
}

export async function sendAlertEmailsForWindow(options: {
  since: Date;
  permitIds?: string[];
  live?: boolean;
}): Promise<{
  sent: number;
  errors: string[];
}> {
  const since = options.since;
  let sent = 0;
  const errors: string[] = [];

  const subscriptions = await prisma.alertSubscription.findMany({
    where: { OR: [{ emailEnabled: true }, { smsEnabled: true }] },
    include: { user: true },
  });

  const permitWhere = options.permitIds?.length
    ? { id: { in: options.permitIds.slice(0, 100) } }
    : { createdAt: { gte: since } };

  const [newPermits, newTenders, gtcSites] = await Promise.all([
    prisma.permit.findMany({
      where: permitWhere,
      orderBy: { issueDate: "desc" },
      take: 200,
    }),
    prisma.tender.findMany({
      where: {
        createdAt: { gte: since },
        closesAt: { gte: new Date() },
        OR: [{ status: null }, { status: { not: "closed" } }],
      },
      orderBy: { closesAt: "asc" },
      take: 50,
    }),
    prisma.contaminatedSite.findMany({
      where: { sourceLayer: "gtc", latitude: { not: null }, longitude: { not: null } },
      select: { latitude: true, longitude: true },
      take: 5000,
    }),
  ]);

  const isNearGtc = (lat?: number | null, lng?: number | null) => {
    if (lat == null || lng == null) return false;
    return gtcSites.some(
      (s) =>
        s.latitude != null &&
        s.longitude != null &&
        haversineKm(lat, lng, s.latitude, s.longitude) < 0.5
    );
  };

  for (const sub of subscriptions) {
    const user = sub.user;
    if (!user?.email && !user?.phone) continue;

    const filters = JSON.parse(sub.filters || "{}") as {
      borough?: string;
      minCost?: string;
      eligibleOnly?: boolean;
      rbqEligible?: boolean;
      noGtc?: boolean;
      city?: string;
    };

    const userTrades = parseJsonArray(user.trades);
    const userRegions = parseJsonArray(user.regions);

    if (sub.module === "chantier_radar") {
      let matches = newPermits.filter((p) =>
        matchesEssentielProfile(user.plan, userTrades, userRegions, {
          trade: p.permitType,
          region: p.borough ?? p.city ?? undefined,
          borough: p.borough ?? undefined,
          title: p.workType ?? undefined,
        })
      );
      if (filters.borough) {
        matches = matches.filter((p) => p.borough?.includes(filters.borough!));
      }
      if (filters.city) {
        matches = matches.filter((p) => p.city?.includes(filters.city!));
      }
      if (filters.minCost) {
        const min = parseFloat(filters.minCost);
        matches = matches.filter((p) => (p.estimatedCost ?? 0) >= min);
      }
      if (filters.eligibleOnly || filters.rbqEligible) {
        matches = matches.filter((p) =>
          computeVerifiedRbqFit(
            user.rbqLicenseClass,
            user.rbqLicenseNumber,
            user.rbqVerified,
            p.permitType,
            p.workType
          ).eligible
        );
      }
      if (filters.noGtc) {
        matches = matches.filter((p) => !isNearGtc(p.latitude, p.longitude));
      }

      if (matches.length === 0) continue;

      const top = matches.slice(0, 5);
      const html = `
        <h2>ChantierRadar — ${matches.length} nouveau(x) permis</h2>
        <ul>
          ${top
            .map((p) => {
              const fit = computeVerifiedRbqFit(
                user.rbqLicenseClass,
                user.rbqLicenseNumber,
                user.rbqVerified,
                p.permitType,
                p.workType
              );
              const flags = [
                fit.eligible ? "RBQ éligible" : null,
                (p.estimatedCost ?? 0) >= 500_000 ? "Gros projet" : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return `<li><strong>${p.permitType}</strong> — ${p.address} (${p.city ?? "Montréal"})${flags ? ` <em>[${flags}]</em>` : ""}</li>`;
            })
            .join("")}
        </ul>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/fr/feed">Voir le fil ZONNING</a></p>
      `;

      const smsBody = `ZONNING: ${matches.length} permis — ${top[0]?.address?.slice(0, 40) ?? "voir app"}`;

      const result = await dispatchAlert({
        email: sub.emailEnabled ? user.email : null,
        phone: user.phone,
        smsEnabled:
          sub.smsEnabled &&
          user.alertSmsEnabled &&
          (user.plan === "PRO" || user.plan === "EQUIPE"),
        subject: `ZONNING — ${matches.length} nouveaux permis`,
        html,
        smsBody,
      });

      if (result.email || result.sms) {
        sent++;
        if (user.email) {
          await prisma.emailLog.create({
            data: {
              userId: user.id,
              email: user.email,
              subject: `Alerte permis (${matches.length})`,
              type: "alert_permit",
            },
          });
        }
      }
    }

    if (sub.module === "marches_qc") {
      const filters = JSON.parse(sub.filters || "{}") as {
        category?: string;
        region?: string;
        q?: string;
        ampOnly?: boolean;
      };

      const matches = newTenders.filter((t) => {
        const title = t.title.toLowerCase();
        const region = (t.region ?? "").toLowerCase();
        const org = (t.organization ?? "").toLowerCase();
        const tradeHit = userTrades.some((tr) => title.includes(tr.toLowerCase()));
        const regionHit = userRegions.some((r) => region.includes(r.toLowerCase()));
        const profileOk = matchesEssentielProfile(user.plan, userTrades, userRegions, {
          title: t.title,
          region: t.region ?? undefined,
        });
        if (!profileOk) return false;
        if (filters.category && t.category !== filters.category) return false;
        if (filters.region && !region.includes(filters.region.toLowerCase())) return false;
        if (filters.ampOnly && !t.requiresAmp) return false;
        if (filters.q) {
          const needle = filters.q.toLowerCase();
          if (
            !title.includes(needle) &&
            !org.includes(needle) &&
            !(t.description ?? "").toLowerCase().includes(needle)
          ) {
            return false;
          }
        }
        return tradeHit || regionHit || newTenders.length <= 5;
      });

      if (matches.length === 0) continue;

      const html = `
        <h2>MarchésQC — ${matches.length} appel(s) d'offres</h2>
        <ul>
          ${matches
            .slice(0, 10)
            .map(
              (t) =>
                `<li><strong>${t.title}</strong> — ${t.organization ?? "SEAO"} (clôture ${t.closesAt?.toLocaleDateString("fr-CA") ?? "?"})</li>`
            )
            .join("")}
        </ul>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/fr/marches-qc">Voir sur ZONNING</a></p>
      `;

      const result = await dispatchAlert({
        email: sub.emailEnabled ? user.email : null,
        phone: user.phone,
        smsEnabled:
          sub.smsEnabled &&
          user.alertSmsEnabled &&
          (user.plan === "PRO" || user.plan === "EQUIPE"),
        subject: `ZONNING — ${matches.length} appels d'offres SEAO`,
        html,
        smsBody: `ZONNING SEAO: ${matches.length} avis — clôture ${matches[0]?.closesAt ? format(matches[0].closesAt, "d MMM", { locale: fr }) : "?"}`,
      });

      if (result.email || result.sms) {
        sent++;
        if (user.email) {
          await prisma.emailLog.create({
            data: {
              userId: user.id,
              email: user.email,
              subject: `Alerte SEAO (${matches.length})`,
              type: "alert_tender",
            },
          });
        }
      }
    }
  }

  return { sent, errors };
}

export async function sendThursdayCloseAlerts(): Promise<{
  sent: number;
  errors: string[];
}> {
  let sent = 0;
  const errors: string[] = [];
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const nextThu = nextThursday(now);
  const endNextThu = new Date(nextThu);
  endNextThu.setHours(23, 59, 59, 999);

  const tenders = await prisma.tender.findMany({
    where: {
      closesAt: {
        gte: isThursday(now) ? now : nextThu,
        lte: isThursday(now) ? endOfToday : endNextThu,
      },
      OR: [{ status: null }, { status: { not: "closed" } }],
    },
    orderBy: { closesAt: "asc" },
    take: 50,
  });

  if (tenders.length === 0) return { sent, errors };

  const users = await prisma.user.findMany({
    where: { plan: { in: ["ESSENTIEL", "PRO", "EQUIPE"] } },
    include: { alerts: { where: { module: "marches_qc" } } },
  });

  for (const user of users) {
    const hasAlert = user.alerts.length > 0;
    if (!hasAlert && user.plan === "FREE") continue;

    const html = `
      <h2>⚠ Clôture jeudi — ${tenders.length} appel(s) SEAO</h2>
      <p>31% des soumissions SEAO se ferment un jeudi. Ne manquez pas ces échéances:</p>
      <ul>
        ${tenders
          .slice(0, 8)
          .map(
            (t) =>
              `<li><strong>${t.title}</strong> — ${t.closesAt?.toLocaleDateString("fr-CA")}</li>`
          )
          .join("")}
      </ul>
    `;

    const result = await dispatchAlert({
      email: user.email,
      phone: user.phone,
      smsEnabled:
        user.alertSmsEnabled && user.alerts.some((a) => a.smsEnabled),
      subject: `ZONNING — ${tenders.length} SEAO ferment jeudi`,
      html,
      smsBody: `ZONNING: ${tenders.length} SEAO ferment jeudi — agissez maintenant`,
    });

    if (result.email || result.sms) sent++;
  }

  return { sent, errors };
}

export async function sendWeeklyDigests(): Promise<{ sent: number; errors: string[] }> {
  const weekAgo = subDays(new Date(), 7);
  let sent = 0;
  const errors: string[] = [];

  const [users, digestSubs] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: weekAgo } }],
      },
      take: 200,
    }),
    prisma.digestSubscriber.findMany({ where: { active: true }, take: 500 }),
  ]);

  const [permitsWeek, tendersOpen] = await Promise.all([
    prisma.permit.count({ where: { issueDate: { gte: weekAgo } } }),
    prisma.tender.count({
      where: {
        closesAt: { gte: new Date() },
        OR: [{ status: null }, { status: { not: "closed" } }],
      },
    }),
  ]);

  for (const user of users) {
    const trades = parseJsonArray(user.trades);
    const regions = parseJsonArray(user.regions);

    const html = `
      <h2>Votre digest ZONNING — semaine en cours</h2>
      <p>Bonjour ${user.name ?? ""},</p>
      <ul>
        <li><strong>${permitsWeek}</strong> nouveaux permis au Québec métropolitain</li>
        <li><strong>${tendersOpen}</strong> appels d'offres SEAO ouverts</li>
        ${trades.length ? `<li>Vos métiers: ${trades.join(", ")}</li>` : ""}
        ${regions.length ? `<li>Vos régions: ${regions.join(", ")}</li>` : ""}
      </ul>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/fr/feed">Ouvrir ZONNING</a></p>
    `;

    const result = await sendEmail({
      to: user.email,
      subject: "ZONNING — Digest hebdomadaire construction & SEAO",
      html,
    });

    if (result.ok) {
      sent++;
      await prisma.user.update({
        where: { id: user.id },
        data: { lastDigestAt: new Date() },
      });
      await prisma.emailLog.create({
        data: {
          userId: user.id,
          email: user.email,
          subject: "Digest hebdomadaire",
          type: "digest",
        },
      });
    } else if (result.error) errors.push(result.error);
  }

  for (const sub of digestSubs) {
    const boroughFilter = sub.borough
      ? { borough: { contains: sub.borough } }
      : {};
    const permits = await prisma.permit.findMany({
      where: { issueDate: { gte: weekAgo }, ...boroughFilter },
      take: 15,
      orderBy: { issueDate: "desc" },
    });

    const html = `
      <h2>Digest permis — ${sub.borough ?? "Grand Montréal"}</h2>
      <p>${permits.length} permis cette semaine</p>
      <ul>${permits.map((p) => `<li>${p.permitType} — ${p.address}</li>`).join("")}</ul>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/fr/pricing">Passer à ZONNING Essentiel</a></p>
    `;

    const result = await sendEmail({
      to: sub.email,
      subject: `ZONNING — ${permits.length} permis cette semaine`,
      html,
    });
    if (result.ok) sent++;
  }

  return { sent, errors };
}
