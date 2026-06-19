"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Radio, Landmark, Users, ShieldCheck, ArrowRight } from "lucide-react";
import { FadeIn } from "@/components/ui";

const icons = {
  chantier: Radio,
  marches: Landmark,
  partenaires: Users,
  compliance: ShieldCheck,
} as const;

export function HomeFeatureGrid() {
  const t = useTranslations("features");
  const h = useTranslations("hero");

  const features = [
    { key: "chantier" as const, href: "/chantier-radar" },
    { key: "marches" as const, href: "/marches-qc" },
    { key: "partenaires" as const, href: "/partenaires-ca" },
    { key: "compliance" as const, href: "/compliance" },
  ];

  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-20 md:grid-cols-2 lg:grid-cols-4">
      {features.map((f, i) => {
        const Icon = icons[f.key];
        return (
          <FadeIn key={f.key} delay={i * 0.05}>
            <Link
              href={f.href}
              className="group flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-sky-500/40 hover:bg-slate-900/80"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-sky-400">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{t(`${f.key}.title`)}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                {t(`${f.key}.desc`)}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-400 group-hover:gap-2 transition-all">
                {h("explore")}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </FadeIn>
        );
      })}
    </section>
  );
}
