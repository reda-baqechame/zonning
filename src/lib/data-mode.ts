import { isPostgresUrl, resolveDatabaseUrl } from "@/lib/env-resolve";

export type RuntimeDataMode = "live" | "local";

export function getRuntimeDataMode(): RuntimeDataMode {
  const url = resolveDatabaseUrl();
  return process.env.NODE_ENV === "production" || isPostgresUrl(url) ? "live" : "local";
}
