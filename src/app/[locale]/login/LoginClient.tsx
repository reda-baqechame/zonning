"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input, FieldLabel, FieldError, Button, Card, FadeIn } from "@/components/ui";

export default function LoginClient() {
  const t = useTranslations("auth");
  const c = useTranslations("common");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? c("error"));
      setLoading(false);
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
    <FadeIn className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-white">{t("signIn")}</h1>
      {process.env.NODE_ENV !== "production" && (
        <p className="mt-2 text-sm text-slate-500">{c("demoHint")}</p>
      )}
      <Card className="mt-8">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
            <Input
              id="email"
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error ? " " : undefined}
            />
          </div>
          <div>
            <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
            <Input
              id="password"
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error ? " " : undefined}
            />
          </div>
          <FieldError message={error} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? c("loading") : t("signIn")}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-400">
        {t("noAccount")}{" "}
        <Link href="/register" className="text-sky-400 hover:underline">
          {t("signUp")}
        </Link>
      </p>
    </FadeIn>
  );
}
