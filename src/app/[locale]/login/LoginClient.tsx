"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LoginClient() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erreur");
      return;
    }
    const settingsRes = await fetch("/api/user/settings");
    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      router.push(settings.user?.onboardingComplete ? "/feed" : "/onboarding");
    } else {
      router.push("/feed");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-white">{t("signIn")}</h1>
      <p className="mt-2 text-sm text-slate-500">Demo: demo@zonning.ca / demo1234</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="text-sm text-slate-400">{t("email")}</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400">{t("password")}</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-sky-500 py-2.5 font-semibold hover:bg-sky-400"
        >
          {t("signIn")}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        {t("noAccount")}{" "}
        <Link href="/register" className="text-sky-400 hover:underline">
          {t("signUp")}
        </Link>
      </p>
    </div>
  );
}
