"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Input, FieldLabel, Button, PageHeader, useToast, FadeIn } from "@/components/ui";

export default function ThermopompeClient() {
  const { success } = useToast();
  const [surface, setSurface] = useState(1500);
  const [email, setEmail] = useState("");
  const rebate = Math.round(surface * 0.8 * 12);

  const capture = async () => {
    if (!email) return;
    await fetch("/api/digest/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, trade: "chauffage", borough: "Laval" }),
    });
    success("Digest HVAC — inscription confirmée");
  };

  return (
    <FadeIn className="mx-auto max-w-lg px-4 py-16">
      <PageHeader
        title="Calculateur thermopompe QC"
        subtitle="Estimez vos rabais — puis recevez les permis HVAC de votre région via ZONNING."
      />
      <label className="mt-8 block text-sm text-slate-400">Superficie (pi²)</label>
      <input
        type="range"
        min={800}
        max={4000}
        value={surface}
        onChange={(e) => setSurface(parseInt(e.target.value))}
        className="mt-2 w-full"
      />
      <p className="mt-4 text-2xl font-bold text-emerald-300">
        Rabais estimé: ~{rebate.toLocaleString("fr-CA")} $ / an
      </p>
      <FieldLabel htmlFor="email">Courriel</FieldLabel>
      <Input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Courriel pour digest permis HVAC"
      />
      <Button type="button" onClick={capture} className="mt-4 w-full">
        Recevoir les permis chauffage
      </Button>
      <Link href="/pricing" className="mt-6 block text-center text-sm text-sky-400">
        Passer à ChantierRadar Essentiel →
      </Link>
    </FadeIn>
  );
}
