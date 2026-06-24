import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

export function loadProdEnv(options?: { productionOnly?: boolean }) {
  const files = options?.productionOnly
    ? [".env.production.local", ".env.production.secrets"]
    : [".env.production.local", ".env.production.secrets", ".env.local", ".env"];
  for (const file of files) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!val) continue;
      process.env[key] = val;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  loadProdEnv();
  console.log("Loaded production env files");
}
