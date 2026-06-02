import type { NextRequest } from "next/server";
import {
  apiKeyFromRequest,
  paramsToObject,
  parseEvent,
  resolveApp,
  writeEvents,
} from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// GET /api/e?key=...&event=video_exported&uid=abc&session=s1&format=mp4
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const app = await resolveApp(apiKeyFromRequest(req, sp));
  if (!app) return json({ ok: false, error: "invalid api key" }, 401);

  const parsed = parseEvent(paramsToObject(sp));
  if (!parsed) return json({ ok: false, error: "missing event name" }, 400);

  await writeEvents(app.id, [parsed]);
  return json({ ok: true });
}

// POST /api/e  body: { event, uid?, session?, ts?, ...props }
export async function POST(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const app = await resolveApp(apiKeyFromRequest(req, sp));
  if (!app) return json({ ok: false, error: "invalid api key" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid json" }, 400);
  }

  const parsed = parseEvent(body);
  if (!parsed) return json({ ok: false, error: "missing event name" }, 400);

  await writeEvents(app.id, [parsed]);
  return json({ ok: true });
}
