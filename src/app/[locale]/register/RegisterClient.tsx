"use client";

import { useState } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { RBQ_LICENSE_CLASSES } from "@/lib/rbq";

export default function RegisterClient() {
  const t = useTranslations("auth");
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
    if (!res.ok) {
      setError(data.error ?? "Erreur");
      return;
    }
    router.push("/onboarding");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-white">{t("signUp")}</h1>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {(["email", "password", "name", "company"] as const).map((field) => (
          <div key={field}>
            <label className="text-sm text-slate-400">
              {t(field === "company" ? "company" : field)}
            </label>
            <input
              required={field === "email" || field === "password"}
              type={field === "password" ? "password" : field === "email" ? "email" : "text"}
              value={form[field === "company" ? "companyName" : field]}
              onChange={(e) =>
                setForm({
                  ...form,
                  [field === "company" ? "companyName" : field]: e.target.value,
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
          </div>
        ))}
        <div>
          <label className="text-sm text-slate-400">{t("rbqClass")}</label>
          <select
            value={form.rbqLicenseClass}
            onChange={(e) => setForm({ ...form, rbqLicenseClass: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          >
            <option value="">—</option>
            {RBQ_LICENSE_CLASSES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.labelFr}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-slate-400">{t("rbqNumber")}</label>
          <input
            value={form.rbqLicenseNumber}
            onChange={(e) => setForm({ ...form, rbqLicenseNumber: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            required
            checked={form.acceptTerms}
            onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
            className="mt-1"
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
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-sky-500 py-2.5 font-semibold hover:bg-sky-400"
        >
          {t("signUp")}
        </button>
      </form>
    </div>
  );
}
