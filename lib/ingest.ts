import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

// Reserved keys are pulled out of the request; everything else becomes `props`.
const RESERVED = new Set([
  "app",
  "key",
  "apikey",
  "event",
  "e",
  "uid",
  "session",
  "sid",
  "ts",
  "clientTs",
]);

export type ParsedEvent = {
  name: string;
  uid?: string;
  sessionId?: string;
  clientTs?: Date;
  props: Record<string, unknown>;
};

// Resolve an app from its API key. Key may come from header or query param.
export async function resolveApp(apiKey: string | null) {
  if (!apiKey) return null;
  return prisma.app.findUnique({ where: { apiKey } });
}

export function apiKeyFromRequest(
  req: Request,
  searchParams: URLSearchParams,
): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return (
    req.headers.get("x-api-key") ??
    searchParams.get("key") ??
    searchParams.get("apikey")
  );
}

// Build a single event from query params (GET) or a JSON object (POST/batch).
export function parseEvent(source: Record<string, unknown>): ParsedEvent | null {
  const name = (source.event ?? source.e ?? source.name) as string | undefined;
  if (!name || typeof name !== "string") return null;

  const uid = pickStr(source.uid);
  const sessionId = pickStr(source.session ?? source.sid ?? source.sessionId);
  const clientTs = parseTs(source.ts ?? source.clientTs);

  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (RESERVED.has(k) || k === "name" || k === "sessionId") continue;
    props[k] = v;
  }

  return { name, uid, sessionId, clientTs, props };
}

export function paramsToObject(sp: URLSearchParams): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of sp.entries()) o[k] = v;
  return o;
}

// Persist parsed events for an app. Also bumps session heartbeat when an
// event carries a sessionId, so per-event traffic doubles as a liveness ping.
export async function writeEvents(appId: string, events: ParsedEvent[]) {
  if (events.length === 0) return 0;

  await prisma.event.createMany({
    data: events.map((e) => ({
      appId,
      name: e.name,
      uid: e.uid ?? null,
      sessionId: e.sessionId ?? null,
      clientTs: e.clientTs ?? null,
      props: Object.keys(e.props).length
        ? (e.props as Prisma.InputJsonValue)
        : undefined,
    })),
  });

  const withSession = events.filter((e) => e.sessionId);
  await Promise.all(
    withSession.map((e) => touchSession(appId, e.sessionId!, e.uid)),
  );

  return events.length;
}

// Heartbeat: create session on first ping, bump lastSeenAt + pings after.
export async function touchSession(
  appId: string,
  sessionId: string,
  uid?: string,
) {
  return prisma.session.upsert({
    where: { appId_sessionId: { appId, sessionId } },
    create: { appId, sessionId, uid: uid ?? null },
    update: { lastSeenAt: new Date(), pings: { increment: 1 } },
  });
}

function pickStr(v: unknown): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}

function parseTs(v: unknown): Date | undefined {
  if (v == null) return undefined;
  // Accept epoch ms, epoch seconds, or ISO string.
  if (typeof v === "number" || /^\d+$/.test(String(v))) {
    const n = Number(v);
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? undefined : d;
}
