import { execSync } from "child_process";
import { ensureDbProvider, isPostgresUrl } from "./ensure-db-provider";
import { resolveDatabaseUrl, resolveDirectDatabaseUrl } from "../src/lib/env-resolve";

/** Vercel build: schema drift that would lose data must fail the deployment. */
const url = resolveDatabaseUrl() ?? "";
const isPostgres = isPostgresUrl(url);

function run(cmd: string) {
  console.log(`> ${cmd}`);
  execSync(cmd, {
    stdio: "inherit",
    env: process.env,
    shell:
      process.platform === "win32"
        ? process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe"
        : "/bin/sh",
  });
}

if (isPostgres) {
  process.env.DATABASE_URL = resolveDirectDatabaseUrl() ?? url;
}

ensureDbProvider(url);
run("npx prisma generate");

if (isPostgres) {
  run("npx prisma db push");
} else if (url.startsWith("file:")) {
  run("npx prisma migrate deploy");
}

run("npx next build");
