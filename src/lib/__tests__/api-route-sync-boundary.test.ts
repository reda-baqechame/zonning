import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const apiRoot = path.resolve(process.cwd(), "src/app/api");
const forbidden = ["ensureFreshForKey", "ensureQuebecRealtimeFresh"];

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return entry === "route.ts" ? [full] : [];
  });
}

describe("API sync boundary", () => {
  it("does not run background ingestion from user-facing route handlers", () => {
    const offenders = routeFiles(apiRoot).filter((file) => {
      const source = readFileSync(file, "utf8");
      return forbidden.some((token) => source.includes(token));
    });

    expect(offenders.map((file) => path.relative(process.cwd(), file))).toEqual([]);
  });
});
