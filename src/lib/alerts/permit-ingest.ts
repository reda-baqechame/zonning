import { subMinutes } from "date-fns";
import { sendAlertEmailsForWindow } from "@/lib/email/alerts";

const pendingPermitIds = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced live alert check after permit ingest (non-blocking). */
export function schedulePermitIngestAlerts(permitIds: string[]): void {
  if (process.env.LIVE_ALERTS_ENABLED === "false") return;
  for (const id of permitIds) pendingPermitIds.add(id);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const ids = [...pendingPermitIds];
    pendingPermitIds.clear();
    void sendAlertEmailsForWindow({
      since: subMinutes(new Date(), 25),
      permitIds: ids,
      live: true,
    }).catch(() => {});
  }, 5000);
}
