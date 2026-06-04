import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

const DAY = 24 * 60 * 60 * 1000;

// Device split. iOS events carry `device=ios` in props; everything else
// (Android) has no `device` prop (or a non-ios value).
export type Device = "all" | "ios" | "android";

export function parseDevice(v: string | undefined): Device {
  return v === "ios" || v === "android" ? v : "all";
}

// SQL fragment for an events query. Composed into a WHERE that already has a
// leading condition, so it starts with AND. `IS DISTINCT FROM` makes Android
// match rows with NULL props / no device key, which a plain `!=` would drop.
function eventDeviceCond(device: Device): Prisma.Sql {
  if (device === "ios") return Prisma.sql`AND props->>'device' = 'ios'`;
  if (device === "android")
    return Prisma.sql`AND props->>'device' IS DISTINCT FROM 'ios'`;
  return Prisma.empty;
}

// Sessions carry no device of their own, so a session counts for a device when
// it has at least one event of that device. Outer table must be named `sessions`.
function sessionDeviceCond(device: Device): Prisma.Sql {
  if (device === "all") return Prisma.empty;
  const inner =
    device === "ios"
      ? Prisma.sql`e.props->>'device' = 'ios'`
      : Prisma.sql`e.props->>'device' IS DISTINCT FROM 'ios'`;
  return Prisma.sql`AND EXISTS (
    SELECT 1 FROM events e
    WHERE e."appId" = sessions."appId"
      AND e."sessionId" = sessions."sessionId"
      AND ${inner})`;
}

export type AppStats = {
  totalEvents: number;
  events24h: number;
  events7d: number;
  dau: number; // distinct uid in last 24h
  mau: number; // distinct uid in last 30d
  totalUsers: number; // distinct uid all-time
  avgEventsPerUser: number | null;
  avgSessionsPerUser: number | null;
  sessions24h: number;
  avgSessionSec: number | null;
  topEvents: { name: string; count: number }[];
  daily: { day: string; count: number }[]; // last 14 days
};

export async function getAppStats(
  appId: string,
  now: Date,
  device: Device = "all",
): Promise<AppStats> {
  const since24h = new Date(now.getTime() - DAY);
  const since7d = new Date(now.getTime() - 7 * DAY);
  const since30d = new Date(now.getTime() - 30 * DAY);
  const since14d = new Date(now.getTime() - 14 * DAY);
  const ev = eventDeviceCond(device);
  const ses = sessionDeviceCond(device);

  const [
    totalRows,
    events24hRows,
    events7dRows,
    sessions24hRows,
    topRaw,
    dauRows,
    mauRows,
    avgRows,
    dailyRows,
    totalUsersRows,
    totalSessionsRows,
    eventsWithUidRows,
  ] = await Promise.all([
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM events
      WHERE "appId" = ${appId} ${ev}`,
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM events
      WHERE "appId" = ${appId} AND ts >= ${since24h} ${ev}`,
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM events
      WHERE "appId" = ${appId} AND ts >= ${since7d} ${ev}`,
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM sessions
      WHERE "appId" = ${appId} AND "startedAt" >= ${since24h} ${ses}`,
    prisma.$queryRaw<{ name: string; c: bigint }[]>`
      SELECT name, COUNT(*) AS c FROM events
      WHERE "appId" = ${appId} ${ev}
      GROUP BY name ORDER BY c DESC LIMIT 8`,
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(DISTINCT uid) AS c FROM events
      WHERE "appId" = ${appId} AND uid IS NOT NULL AND ts >= ${since24h} ${ev}`,
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(DISTINCT uid) AS c FROM events
      WHERE "appId" = ${appId} AND uid IS NOT NULL AND ts >= ${since30d} ${ev}`,
    prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("lastSeenAt" - "startedAt"))) AS avg
      FROM sessions WHERE "appId" = ${appId} ${ses}`,
    prisma.$queryRaw<{ day: Date; c: bigint }[]>`
      SELECT date_trunc('day', ts) AS day, COUNT(*) AS c FROM events
      WHERE "appId" = ${appId} AND ts >= ${since14d} ${ev}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(DISTINCT uid) AS c FROM events
      WHERE "appId" = ${appId} AND uid IS NOT NULL ${ev}`,
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM events
      WHERE "appId" = ${appId} AND uid IS NOT NULL ${ev}`,
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) AS c FROM sessions
      WHERE "appId" = ${appId} ${ses}`,
  ]);

  const totalUsers = Number(totalUsersRows[0]?.c ?? 0);
  const totalSessions = Number(totalSessionsRows[0]?.c ?? 0);
  // Events with a uid only — anonymous (uid-less) events excluded from per-user avg.
  const eventsWithUid = Number(eventsWithUidRows[0]?.c ?? 0);

  return {
    totalEvents: Number(totalRows[0]?.c ?? 0),
    events24h: Number(events24hRows[0]?.c ?? 0),
    events7d: Number(events7dRows[0]?.c ?? 0),
    sessions24h: Number(sessions24hRows[0]?.c ?? 0),
    dau: Number(dauRows[0]?.c ?? 0),
    mau: Number(mauRows[0]?.c ?? 0),
    totalUsers,
    avgEventsPerUser: totalUsers ? round1(eventsWithUid / totalUsers) : null,
    avgSessionsPerUser: totalUsers ? round1(totalSessions / totalUsers) : null,
    avgSessionSec: avgRows[0]?.avg != null ? Math.round(avgRows[0].avg) : null,
    topEvents: topRaw.map((r) => ({ name: r.name, count: Number(r.c) })),
    daily: fill14Days(dailyRows, now),
  };
}

// Zero-fill a continuous 14-day window so charts have no gaps.
function fill14Days(
  rows: { day: Date; c: bigint }[],
  now: Date,
): { day: string; count: number }[] {
  const byDay = new Map(
    rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.c)]),
  );
  const out: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now.getTime() - i * DAY).toISOString().slice(0, 10);
    out.push({ day, count: byDay.get(day) ?? 0 });
  }
  return out;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type AppUser = {
  uid: string;
  events: number;
  sessions: number;
  totalSec: number;
  firstSeen: string;
  lastSeen: string;
  country: string | null;
};

// Per-user roll-up for an app, ranked by event count.
export async function listAppUsers(
  appId: string,
  limit = 100,
  device: Device = "all",
): Promise<AppUser[]> {
  const ev = eventDeviceCond(device);
  const ses = sessionDeviceCond(device);
  const [evRows, sessRows] = await Promise.all([
    prisma.$queryRaw<
      { uid: string; events: bigint; first: Date; last: Date; country: string | null }[]
    >`
      SELECT uid, COUNT(*) AS events, MIN(ts) AS first, MAX(ts) AS last,
        (array_agg(upper(props->>'country') ORDER BY ts DESC)
           FILTER (WHERE props->>'country' IS NOT NULL))[1] AS country
      FROM events
      WHERE "appId" = ${appId} AND uid IS NOT NULL ${ev}
      GROUP BY uid ORDER BY events DESC LIMIT ${limit}`,
    prisma.$queryRaw<{ uid: string; sessions: bigint; sec: number | null }[]>`
      SELECT uid, COUNT(*) AS sessions,
             SUM(EXTRACT(EPOCH FROM ("lastSeenAt" - "startedAt"))) AS sec
      FROM sessions
      WHERE "appId" = ${appId} AND uid IS NOT NULL ${ses}
      GROUP BY uid`,
  ]);

  const sessMap = new Map(
    sessRows.map((r) => [r.uid, { sessions: Number(r.sessions), sec: Number(r.sec ?? 0) }]),
  );

  return evRows.map((r) => {
    const s = sessMap.get(r.uid);
    return {
      uid: r.uid,
      events: Number(r.events),
      sessions: s?.sessions ?? 0,
      totalSec: Math.round(s?.sec ?? 0),
      firstSeen: r.first.toISOString(),
      lastSeen: r.last.toISOString(),
      country: r.country ?? null,
    };
  });
}

export type GeoRow = { code: string; users: number; events: number };
export type AppGeo = {
  countries: GeoRow[];
  languages: GeoRow[];
  knownCountryUsers: number; // distinct users with a country (for % base)
};

// Geo breakdown for an app, sourced from event props (country, lang).
export async function listAppGeo(
  appId: string,
  device: Device = "all",
): Promise<AppGeo> {
  const ev = eventDeviceCond(device);
  const [countries, languages, baseRows] = await Promise.all([
    prisma.$queryRaw<{ code: string; users: bigint; events: bigint }[]>`
      SELECT upper(props->>'country') AS code,
             COUNT(DISTINCT uid) AS users, COUNT(*) AS events
      FROM events
      WHERE "appId" = ${appId} AND props->>'country' IS NOT NULL ${ev}
      GROUP BY 1 ORDER BY users DESC, events DESC LIMIT 12`,
    prisma.$queryRaw<{ code: string; users: bigint; events: bigint }[]>`
      SELECT lower(props->>'lang') AS code,
             COUNT(DISTINCT uid) AS users, COUNT(*) AS events
      FROM events
      WHERE "appId" = ${appId} AND props->>'lang' IS NOT NULL ${ev}
      GROUP BY 1 ORDER BY users DESC, events DESC LIMIT 8`,
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(DISTINCT uid) AS c FROM events
      WHERE "appId" = ${appId} AND props->>'country' IS NOT NULL AND uid IS NOT NULL ${ev}`,
  ]);

  const map = (r: { code: string; users: bigint; events: bigint }): GeoRow => ({
    code: r.code,
    users: Number(r.users),
    events: Number(r.events),
  });

  return {
    countries: countries.map(map),
    languages: languages.map(map),
    knownCountryUsers: Number(baseRows[0]?.c ?? 0),
  };
}

export type UserDetail = {
  uid: string;
  totalEvents: number;
  sessions: number;
  totalSec: number;
  firstSeen: string | null;
  lastSeen: string | null;
  breakdown: { name: string; count: number }[];
  recent: { name: string; ts: string; props: unknown }[];
  geo: { country: string | null; lang: string | null; tz: string | null };
};

// Drill-down for a single user within an app.
export async function getUserDetail(
  appId: string,
  uid: string,
): Promise<UserDetail | null> {
  const totalEvents = await prisma.event.count({ where: { appId, uid } });
  if (totalEvents === 0) return null;

  const [breakdownRaw, recent, sessAgg, span, geoRows] = await Promise.all([
    prisma.event.groupBy({
      by: ["name"],
      where: { appId, uid },
      _count: { name: true },
      orderBy: { _count: { name: "desc" } },
    }),
    prisma.event.findMany({
      where: { appId, uid },
      orderBy: { ts: "desc" },
      take: 50,
      select: { name: true, ts: true, props: true },
    }),
    prisma.$queryRaw<{ sessions: bigint; sec: number | null }[]>`
      SELECT COUNT(*) AS sessions,
             SUM(EXTRACT(EPOCH FROM ("lastSeenAt" - "startedAt"))) AS sec
      FROM sessions WHERE "appId" = ${appId} AND uid = ${uid}`,
    prisma.$queryRaw<{ first: Date; last: Date }[]>`
      SELECT MIN(ts) AS first, MAX(ts) AS last
      FROM events WHERE "appId" = ${appId} AND uid = ${uid}`,
    // Most recent non-null geo values for this user.
    prisma.$queryRaw<{ country: string | null; lang: string | null; tz: string | null }[]>`
      SELECT
        (SELECT upper(props->>'country') FROM events
           WHERE "appId" = ${appId} AND uid = ${uid} AND props->>'country' IS NOT NULL
           ORDER BY ts DESC LIMIT 1) AS country,
        (SELECT lower(props->>'lang') FROM events
           WHERE "appId" = ${appId} AND uid = ${uid} AND props->>'lang' IS NOT NULL
           ORDER BY ts DESC LIMIT 1) AS lang,
        (SELECT props->>'tz' FROM events
           WHERE "appId" = ${appId} AND uid = ${uid} AND props->>'tz' IS NOT NULL
           ORDER BY ts DESC LIMIT 1) AS tz`,
  ]);

  return {
    uid,
    totalEvents,
    sessions: Number(sessAgg[0]?.sessions ?? 0),
    totalSec: Math.round(Number(sessAgg[0]?.sec ?? 0)),
    firstSeen: span[0]?.first?.toISOString() ?? null,
    lastSeen: span[0]?.last?.toISOString() ?? null,
    breakdown: breakdownRaw.map((r) => ({ name: r.name, count: r._count.name })),
    recent: recent.map((e) => ({
      name: e.name,
      ts: e.ts.toISOString(),
      props: e.props,
    })),
    geo: {
      country: geoRows[0]?.country ?? null,
      lang: geoRows[0]?.lang ?? null,
      tz: geoRows[0]?.tz ?? null,
    },
  };
}

export type Overview = {
  totalEvents: number;
  totalUsers: number;
  totalApps: number;
  events7d: number;
  eventsDelta: number | null; // % vs previous 7d
  users7d: number;
  usersDelta: number | null;
  avgSessionSec: number | null;
  sessions7d: number;
  sessionsDelta: number | null;
  daily: number[]; // events/day, last 14d (sparkline)
};

function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return cur > 0 ? 100 : null;
  return Math.round(((cur - prev) / prev) * 100);
}

// Cross-app rollup for the overview dashboard.
export async function getOverview(now: Date): Promise<Overview> {
  const d7 = new Date(now.getTime() - 7 * DAY);
  const d14 = new Date(now.getTime() - 14 * DAY);

  const [
    totalEvents,
    totalApps,
    events7d,
    eventsPrev7d,
    sessions7d,
    sessionsPrev7d,
    totalUsersRows,
    users7dRows,
    usersPrev7dRows,
    avgRows,
    dailyRows,
  ] = await Promise.all([
    prisma.event.count(),
    prisma.app.count(),
    prisma.event.count({ where: { ts: { gte: d7 } } }),
    prisma.event.count({ where: { ts: { gte: d14, lt: d7 } } }),
    prisma.session.count({ where: { startedAt: { gte: d7 } } }),
    prisma.session.count({ where: { startedAt: { gte: d14, lt: d7 } } }),
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(DISTINCT uid) AS c FROM events WHERE uid IS NOT NULL`,
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(DISTINCT uid) AS c FROM events
      WHERE uid IS NOT NULL AND ts >= ${d7}`,
    prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(DISTINCT uid) AS c FROM events
      WHERE uid IS NOT NULL AND ts >= ${d14} AND ts < ${d7}`,
    prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("lastSeenAt" - "startedAt"))) AS avg FROM sessions`,
    prisma.$queryRaw<{ day: Date; c: bigint }[]>`
      SELECT date_trunc('day', ts) AS day, COUNT(*) AS c FROM events
      WHERE ts >= ${d14} GROUP BY 1 ORDER BY 1`,
  ]);

  const users7d = Number(users7dRows[0]?.c ?? 0);
  const usersPrev = Number(usersPrev7dRows[0]?.c ?? 0);

  // Fill a continuous 14-day series so the sparkline has no gaps.
  const byDay = new Map(
    dailyRows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.c)]),
  );
  const daily: number[] = [];
  for (let i = 13; i >= 0; i--) {
    const key = new Date(now.getTime() - i * DAY).toISOString().slice(0, 10);
    daily.push(byDay.get(key) ?? 0);
  }

  return {
    totalEvents,
    totalApps,
    totalUsers: Number(totalUsersRows[0]?.c ?? 0),
    events7d,
    eventsDelta: pctDelta(events7d, eventsPrev7d),
    users7d,
    usersDelta: pctDelta(users7d, usersPrev),
    sessions7d,
    sessionsDelta: pctDelta(sessions7d, sessionsPrev7d),
    avgSessionSec: avgRows[0]?.avg != null ? Math.round(avgRows[0].avg) : null,
    daily,
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
