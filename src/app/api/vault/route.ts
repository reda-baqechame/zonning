import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, rateLimitResponse, clientIp } from "@/lib/rate-limit";
import { extractWithAi, extractDeterministic } from "@/lib/vault/extract";

/**
 * Document Intelligence Vault.
 *
 * POST /api/vault  (multipart/form-data: field "file" + optional "sourceUrl")
 *   - User uploads a tender/permit PDF/TXT they legally obtained.
 *   - We extract plain text (PDF text layer) and run the extractor.
 *   - The structured extraction is persisted; only a textPreview is kept.
 *   - Raw bytes are NOT persisted when no private object store is configured
 *     (Law 25 / PIPEDA: never retain data we can't delete/secure).
 *
 * GET /api/vault  → list the caller's vault documents.
 * DELETE /api/vault?id=...  → soft-delete one document (retention / Law 25).
 */

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED = new Set(["application/pdf", "text/plain", "text/csv"]);

function extractTextFromBuffer(buf: ArrayBuffer, mime: string): string {
  if (mime === "text/plain" || mime === "text/csv") {
    return new TextDecoder().decode(buf);
  }
  // For PDFs without a PDF-parsing dependency installed, we attempt a best-effort
  // text-layer extraction by scanning for parenthesised PDF text-showing
  // operators (Tj/TJ). This is intentionally lightweight and never decrypts.
  // A future enhancement wires pdfjs-dist when OPENAI is configured.
  const text = new TextDecoder("latin1").decode(buf);
  const chunks: string[] = [];
  const re = /\(([^()\\]{1,200})\)\s*Tj/g;
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = re.exec(text)) && count < 4000) {
    if (m[1].trim()) chunks.push(m[1]);
    count++;
  }
  return chunks.join("\n");
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:vault:${ip}`, 30, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const docs = await prisma.vaultDocument.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      sourceUrl: true,
      extraction: true,
      extractedWithAi: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ documents: docs });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:vault:${ip}`, 10, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }
  const file = form.get("file");
  const sourceUrl = typeof form.get("sourceUrl") === "string" ? String(form.get("sourceUrl")) : null;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8 MB)." }, { status: 413 });
  }

  const mime = file.type || "application/octet-stream";
  if (!ACCEPTED.has(mime) && !/\.(txt|csv|pdf)$/i.test(file.name)) {
    return NextResponse.json({ error: "Unsupported file type. Use PDF, TXT, or CSV." }, { status: 415 });
  }

  const buf = await file.arrayBuffer();
  const text = extractTextFromBuffer(buf, mime);
  if (!text || text.trim().length < 20) {
    return NextResponse.json(
      { error: "Could not extract text from this document. If it is a scanned PDF, provide a text-based copy." },
      { status: 422 },
    );
  }

  const extraction =
    (await extractWithAi(text).catch(() => null)) ?? extractDeterministic(text);
  const preview = text.slice(0, 4_000);

  const doc = await prisma.vaultDocument.create({
    data: {
      userId: user.id,
      fileName: file.name,
      sourceUrl,
      // Storage key: we do not persist raw bytes without a configured private
      // bucket; the preview + extraction carry the actionable value.
      storageKey: `vault/${user.id}/${Date.now()}-${file.name}`,
      mimeType: mime,
      byteSize: file.size,
      textPreview: preview,
      extraction: JSON.stringify(extraction),
      extractedWithAi: extraction.extractedWithAi,
    },
  });

  return NextResponse.json({
    id: doc.id,
    fileName: doc.fileName,
    extraction,
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Law 25: user can purge their own document.
  const updated = await prisma.vaultDocument.updateMany({
    where: { id, userId: user.id, deletedAt: null },
    data: { deletedAt: new Date(), textPreview: null, extraction: null },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
