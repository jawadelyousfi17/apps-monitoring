import type { NextRequest } from "next/server";
import { apiKeyFromRequest, resolveApp, touchSession } from "@/lib/ingest";

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

// Heartbeat. Call every 15-30s while the app is open.
// GET /api/hb?key=...&session=s1&uid=abc
async function handle(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const app = await resolveApp(apiKeyFromRequest(req, sp));
  if (!app) return json({ ok: false, error: "invalid api key" }, 401);

  const sessionId = sp.get("session") ?? sp.get("sid");
  if (!sessionId) return json({ ok: false, error: "missing session" }, 400);

  const uid = sp.get("uid") ?? undefined;
  const s = await touchSession(app.id, sessionId, uid);
  const durationMs = s.lastSeenAt.getTime() - s.startedAt.getTime();
  return json({ ok: true, durationMs, pings: s.pings });
}

export const GET = handle;
export const POST = handle;
