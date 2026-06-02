import { prisma } from "@/lib/prisma";

const DAY = 24 * 60 * 60 * 1000;

export type AppStats = {
  totalEvents: number;
  events24h: number;
  events7d: number;
  dau: number; // distinct uid in last 24h
  mau: number; // distinct uid in last 30d
  sessions24h: number;
  avgSessionSec: number | null;
  topEvents: { name: string; count: number }[];
  daily: { day: string; count: number }[]; // last 14 days
};

export async function getAppStats(appId: string, now: Date): Promise<AppStats> {
  const since24h = new Date(now.getTime() - DAY);
  const since7d = new Date(now.getTime() - 7 * DAY);
  const since30d = new Date(now.getTime() - 30 * DAY);

  const [
    totalEvents,
    events24h,
    events7d,
    sessions24h,
    topRaw,
    dauRows,
    mauRows,
    avgRows,
    dailyRows,
  ] = await Promise.all([
    prisma.event.count({ where: { appId } }),
    prisma.event.count({ where: { appId, ts: { gte: since24h } } }),
    prisma.event.count({ where: { appId, ts: { gte: since7d } } }),
    prisma.session.count({ where: { appId, startedAt: { gte: since24h } } }),
    prisma.event.groupBy({
      by: ["name"],
      where: { appId },
      _count: { name: true },
      orderBy: { _count: { name: "desc" } },
      take: 8,
    }),
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(DISTINCT uid) AS c FROM events
      WHERE "appId" = ${appId} AND uid IS NOT NULL AND ts >= ${since24h}`,
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(DISTINCT uid) AS c FROM events
      WHERE "appId" = ${appId} AND uid IS NOT NULL AND ts >= ${since30d}`,
    prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("lastSeenAt" - "startedAt"))) AS avg
      FROM sessions WHERE "appId" = ${appId}`,
    prisma.$queryRaw<{ day: Date; c: bigint }[]>`
      SELECT date_trunc('day', ts) AS day, COUNT(*) AS c FROM events
      WHERE "appId" = ${appId} AND ts >= ${new Date(now.getTime() - 14 * DAY)}
      GROUP BY 1 ORDER BY 1`,
  ]);

  return {
    totalEvents,
    events24h,
    events7d,
    sessions24h,
    dau: Number(dauRows[0]?.c ?? 0),
    mau: Number(mauRows[0]?.c ?? 0),
    avgSessionSec: avgRows[0]?.avg != null ? Math.round(avgRows[0].avg) : null,
    topEvents: topRaw.map((r) => ({ name: r.name, count: r._count.name })),
    daily: dailyRows.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      count: Number(r.c),
    })),
  };
}

export async function listAppsWithCounts() {
  const apps = await prisma.app.findMany({ orderBy: { createdAt: "desc" } });
  const counts = await prisma.event.groupBy({
    by: ["appId"],
    _count: { appId: true },
  });
  const map = new Map(counts.map((c) => [c.appId, c._count.appId]));
  return apps.map((a) => ({ ...a, eventCount: map.get(a.id) ?? 0 }));
}
