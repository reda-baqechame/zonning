export type CreateAlertResult =
  | { ok: true }
  | { ok: false; status: number; error: string; upgrade?: boolean };

export async function createAlert(payload: {
  module: string;
  filters: Record<string, unknown>;
}): Promise<CreateAlertResult> {
  const res = await fetch("/api/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: (data.error as string) ?? "Error",
      upgrade: res.status === 403,
    };
  }
  return { ok: true };
}
