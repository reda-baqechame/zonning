/**
 * Lightweight, dependency-free logging for the dataset fetch layer.
 *
 * Historically `client.ts` returned `null`/`[]` on every non-OK response or
 * empty payload. Combined with fetchers that treat an empty array as "0 rows
 * synced successfully", a failed external fetch looked identical to a healthy
 * sync — the database stayed empty while the dashboard went green. That is the
 * root cause of the "nothing works / pages render blank" complaint.
 *
 * These helpers make those failures visible in logs (and, where a datasetId is
 * known, the runner persists them to SyncLog/SyncState). They never throw, so
 * call sites keep their existing control flow.
 */

let warnCount = 0;

export function dataWarn(operation: string, detail: Record<string, unknown>): void {
  warnCount++;
  // Structured single-line warning so it is greppable in Vercel logs.
  console.warn(
    `[datasets] ${operation} returned no usable data`,
    JSON.stringify(detail),
  );
}

/** For tests/diagnostics — how many warnings have been emitted this process. */
export function getDataWarnCount(): number {
  return warnCount;
}

export function resetDataWarnCount(): void {
  warnCount = 0;
}
