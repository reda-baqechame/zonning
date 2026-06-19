"use client";

import { useState } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { RBQ_LICENSE_CLASSES } from "@/lib/rbq";
import {
  Input,
  Select,
  FieldLabel,
  FieldError,
  Button,
  Card,
  FadeIn,
  PageHeader,
} from "@/components/ui";

export default function RegisterClient() {
  const t = useTranslations("auth");
  const c = useTranslations("common");
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    companyName: "",
    rbqLicenseClass: "",
    rbqLicenseNumber: "",
    acceptTerms: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        name: form.name,
        companyName: form.companyName,
        rbqLicenseClass: form.rbqLicenseClass,
        rbqLicenseNumber: form.rbqLicenseNumber,
        acceptTerms: form.acceptTerms,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? c("error"));
      return;
    }
    router.push("/onboarding");
  };

  return (
    <FadeIn className="mx-auto max-w-md px-4 py-16">
      <PageHeader title={t("signUp")} />
      <Card>
        <form onSubmit={submit} className="space-y-4">
          {(["email", "password", "name", "company"] as const).map((field) => (
            <div key={field}>
              <FieldLabel htmlFor={field} required={field === "email" || field === "password"}>
                {t(field === "company" ? "company" : field)}
              </FieldLabel>
              <Input
                id={field}
                required={field === "email" || field === "password"}
                type={field === "password" ? "password" : field === "email" ? "email" : "text"}
                value={form[field === "company" ? "companyName" : field]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [field === "company" ? "companyName" : field]: e.target.value,
                  })
                }
              />
            </div>
          ))}
          <div>
            <FieldLabel htmlFor="rbqClass">{t("rbqClass")}</FieldLabel>
            <Select
              id="rbqClass"
              value={form.rbqLicenseClass}
              onChange={(e) => setForm({ ...form, rbqLicenseClass: e.target.value })}
            >
              <option value="">—</option>
              {RBQ_LICENSE_CLASSES.map((cls) => (
                <option key={cls.code} value={cls.code}>
                  {cls.code} — {cls.labelFr}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="rbqNumber">{t("rbqNumber")}</FieldLabel>
            <Input
              id="rbqNumber"
              value={form.rbqLicenseNumber}
              onChange={(e) => setForm({ ...form, rbqLicenseNumber: e.target.value })}
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              required
              checked={form.acceptTerms}
              onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
              className="mt-1 accent-sky-500"
            />
            <span>
              J&apos;accepte les{" "}
              <Link href="/terms" className="text-sky-400 hover:underline">
                conditions d&apos;utilisation
              </Link>{" "}
              et la{" "}
              <Link href="/privacy" className="text-sky-400 hover:underline">
                politique de confidentialité
              </Link>
              .
            </span>
          </label>
          <FieldError message={error} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? c("loading") : t("signUp")}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-400">
        {t("hasAccount")}{" "}
        <Link href="/login" className="text-sky-400 hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </FadeIn>
  );
}
