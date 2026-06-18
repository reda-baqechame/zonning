"use client";

import { differenceInHours } from "date-fns";

export default function TenderCountdown({
  closesAt,
  daysLeft,
  isThursday,
  urgent,
  labels,
}: {
  closesAt?: string | null;
  daysLeft?: number | null;
  isThursday?: boolean;
  urgent?: boolean;
  labels: { days: string; closesIn: string; thursday?: string };
}) {
  const hoursLeft =
    closesAt != null ? Math.max(0, differenceInHours(new Date(closesAt), new Date())) : null;

  return (
    <div className="text-right">
      {daysLeft != null && (
        <p className={`text-2xl font-bold ${urgent ? "text-red-400" : "text-sky-300"}`}>
          {daysLeft}
          <span className="ml-1 text-sm font-normal">{labels.days}</span>
        </p>
      )}
      {hoursLeft != null && hoursLeft < 48 && (
        <p className={`text-xs ${urgent ? "text-red-300" : "text-slate-400"}`}>
          {hoursLeft}h {labels.closesIn}
        </p>
      )}
      {isThursday && labels.thursday && (
        <p className="text-xs text-amber-300">{labels.thursday}</p>
      )}
    </div>
  );
}
