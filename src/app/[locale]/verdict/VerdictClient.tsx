"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { COVERAGE_CITIES } from "@/lib/datasets/registry";
import {
  Input,
  Select,
  FieldLabel,
  Button,
  PageHeader,
  useToast,
  FadeIn,
  Card,
} from "@/components/ui";

export default function VerdictClient() {
  const t = useTranslations("verdict");
  const c = useTranslations("common");
  const { error: toastError } = useToast();
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [borough, setBorough] = useState("");
  const [city, setCity] = useState("Montréal");
  const [loading, setLoading] = useState(false);

  const fillExample = () => {
    setAddress("1234 rue Saint-Denis");
    setCity("Montréal");
    setBorough("Ville-Marie");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    const res = await fetch("/api/verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        borough: borough || undefined,
        city: city || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toastError(data.error ?? c("error"));
      return;
    }
    router.push(`/verdict/${data.report.shareSlug}`);
  };

  return (
    <FadeIn className="mx-auto max-w-xl px-4 py-12">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-emerald-400">
        {t("eyebrow")}
      </p>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <FieldLabel htmlFor="address" required>
              {t("addressLabel")}
            </FieldLabel>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("addressLabel")}
              required
            />
            <button
              type="button"
              onClick={fillExample}
              className="mt-2 text-xs text-sky-400 hover:underline"
            >
              {t("exampleAddress")}
            </button>
          </div>
          <div>
            <FieldLabel htmlFor="city">{t("boroughLabel")} / Ville</FieldLabel>
            <Select id="city" value={city} onChange={(e) => setCity(e.target.value)}>
              {COVERAGE_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="borough">{t("boroughLabel")}</FieldLabel>
            <Input
              id="borough"
              value={borough}
              onChange={(e) => setBorough(e.target.value)}
              placeholder={t("boroughPlaceholder")}
            />
          </div>
          <Button type="submit" variant="success" className="w-full" disabled={loading}>
            {loading ? c("loading") : t("cta")}
          </Button>
        </form>
      </Card>

      <p className="mt-8 text-center text-xs text-slate-500">{t("footer")}</p>
    </FadeIn>
  );
}
