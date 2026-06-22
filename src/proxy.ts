import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { getRequestId } from "./lib/request-id";

const intlMiddleware = createIntlMiddleware(routing);

export default function proxy(req: NextRequest) {
  const requestId = getRequestId(req);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  if (req.nextUrl.pathname.startsWith("/api/")) {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("x-request-id", requestId);
    return res;
  }

  const res = intlMiddleware(
    new NextRequest(req.url, { headers: requestHeaders, method: req.method })
  );
  if (res) {
    res.headers.set("x-request-id", requestId);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
