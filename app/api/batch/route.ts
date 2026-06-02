import type { NextRequest } from "next/server";
import {
  apiKeyFromRequest,
  parseEvent,
  resolveApp,
  writeEvents,
  type ParsedEvent,
} from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
};

const MAX_BATCH = 500;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// POST /api/batch  body: { events: [ { event, uid?, session?, ts?, ...props }, ... ] }
// Accepts a bare array too.
export async function POST(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const app = await resolveApp(apiKeyFromRequest(req, sp));
  if (!app) return json({ ok: false, error: "invalid api key" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid json" }, 400);
  }

  const raw = Array.isArray(body)
    ? body
    : Array.isArray((body as { events?: unknown }).events)
      ? (body as { events: unknown[] }).events
      : null;

  if (!raw) return json({ ok: false, error: "expected events array" }, 400);
  if (raw.length > MAX_BATCH) {
    return json({ ok: false, error: `max ${MAX_BATCH} events per batch` }, 413);
  }

  const parsed: ParsedEvent[] = [];
  let rejected = 0;
  for (const item of raw) {
    const p =
      item && typeof item === "object"
        ? parseEvent(item as Record<string, unknown>)
        : null;
    if (p) parsed.push(p);
    else rejected++;
  }

  const accepted = await writeEvents(app.id, parsed);
  return json({ ok: true, accepted, rejected });
}
