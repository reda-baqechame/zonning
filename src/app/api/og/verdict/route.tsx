import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "edge";

const TIER_COLORS: Record<string, string> = {
  insufficient_data: "#94a3b8",
  eleve: "#10b981",
  moyen: "#f59e0b",
  faible: "#94a3b8",
  bloque: "#ef4444",
};

export async function GET(req: NextRequest) {
  const limited = await rateLimitAsync(`api:og-verdict:${clientIp(req)}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { searchParams } = req.nextUrl;
  const tier = (searchParams.get("tier") ?? "moyen").slice(0, 20);
  const label = (searchParams.get("label") ?? "Potentiel").slice(0, 40);
  const address = (searchParams.get("address") ?? "").slice(0, 120);
  const color = TIER_COLORS[tier] ?? "#38bdf8";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
          border: `8px solid ${color}`,
          padding: 48,
        }}
      >
        <div style={{ fontSize: 24, color: "#64748b", letterSpacing: 8 }}>PERMIS.AI</div>
        <div style={{ fontSize: 56, fontWeight: 700, color, marginTop: 24 }}>{label}</div>
        <div style={{ fontSize: 28, color: "#94a3b8", marginTop: 24, textAlign: "center" }}>
          {address}
        </div>
        <div style={{ fontSize: 18, color: "#475569", marginTop: 48 }}>
          Propulsé par ZONNING
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
