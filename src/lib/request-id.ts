import { NextRequest } from "next/server";

export function getRequestId(req?: NextRequest | null): string {
  const fromHeader = req?.headers.get("x-request-id")?.trim();
  if (fromHeader && fromHeader.length <= 64) return fromHeader;
  return crypto.randomUUID();
}

export function requestIdFromHeaders(headers: Headers): string | undefined {
  const id = headers.get("x-request-id")?.trim();
  return id && id.length <= 64 ? id : undefined;
}
