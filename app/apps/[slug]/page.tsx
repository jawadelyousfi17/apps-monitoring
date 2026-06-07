import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminTokens } from "@/lib/auth";
import {
  getAppStats,
  listAppUsers,
  listAppsWithCounts,
  listAppGeo,
  parseDevice,
  parseUserSort,
  parseSortDir,
  type UserSort,
  type SortDir,
} from "@/lib/stats";
import {
  fmtDuration,
  fmtRelative,
  flagEmoji,
  countryName,
  langName,
} from "@/lib/format";
import { Shell, Crumb } from "@/app/_components/Shell";
import { StatCard } from "@/app/_components/StatCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORT_LABELS: Record<UserSort, string> = {
  events: "events",
  sessions: "sessions",
  time: "time in app",
  first: "first seen",
  last: "last seen",
};

export default async function AppPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    token?: string;
    device?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const [{ slug }, { token, device: deviceParam, sort: sortParam, dir: dirParam }] =
    await Promise.all([params, searchParams]);
  const ok = adminTokens().length > 0 && !!token && adminTokens().includes(token);
  if (!ok) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-ink-soft">
        Invalid or missing token.
      </div>
    );
  }

  const app = await prisma.app.findUnique({ where: { slug } });
  if (!app) notFound();

  const device = parseDevice(deviceParam);
  const sort = parseUserSort(sortParam);
  const dir = parseSortDir(dirParam);
  const now = new Date();
  const [stats, users, apps, geo] = await Promise.all([
    getAppStats(app.id, now, device),
    listAppUsers(app.id, 100, device, sort, dir),
    listAppsWithCounts(),
    listAppGeo(app.id, device),
  ]);
  const hasGeo = geo.countries.length > 0 || geo.languages.length > 0;

  const series = stats.daily.map((d) => d.count);
  const maxDaily = Math.max(1, ...series);
  const topEventTotal = stats.topEvents.reduce((s, e) => s + e.count, 0);

  // Build a users-table URL that preserves token + device and toggles sort.
  // Clicking the active column flips direction; a new column starts descending.
  const sortHref = (col: UserSort): string => {
    const qs = new URLSearchParams({ token: token! });
    if (device !== "all") qs.set("device", device);
    qs.set("sort", col);
    const nextDir: SortDir = sort === col && dir === "desc" ? "asc" : "desc";
    qs.set("dir", nextDir);
    return `/apps/${app.slug}?${qs.toString()}#users`;
  };
  const sortArrow = (col: UserSort): string =>
    sort === col ? (dir === "asc" ? "↑" : "↓") : "";

  return (
    <Shell
      token={token!}
      active={app.slug}
      apps={apps.map((a) => ({ slug: a.slug, name: a.name }))}
      breadcrumb={<Crumb items={["Apps Monitoring", app.name]} />}
    >
      <div className="rise mx-auto max-w-6xl">
        <p className="font-display text-lg font-medium text-ink-soft">{app.name}</p>
        <h1 className="grad-text font-display text-6xl font-extrabold tracking-tight sm:text-7xl">
          {stats.totalEvents.toLocaleString()}
        </h1>
        <p className="mt-1 font-mono text-xs text-ink-mute">
          {app.slug} · total events
        </p>

        {/* device filter: both / iOS / Android */}
        <div className="mt-5 inline-flex rounded-full border border-line p-1 text-sm">
          {(
            [
              ["all", "Both"],
              ["ios", "iOS"],
              ["android", "Android"],
            ] as const
          ).map(([val, label]) => {
            const qs = new URLSearchParams({ token: token! });
            if (val !== "all") qs.set("device", val);
            const activeTab = device === val;
            return (
              <Link
                key={val}
                href={`/apps/${app.slug}?${qs.toString()}`}
                className={
                  "rounded-full px-4 py-1.5 font-medium transition " +
                  (activeTab
                    ? "bg-violet text-white"
                    : "text-ink-soft hover:text-ink")
                }
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total users"
            value={stats.totalUsers.toLocaleString()}
            series={series}
            accent="violet"
            caption="distinct users"
          />
          <StatCard
            label="Avg events / user"
            value={stats.avgEventsPerUser ?? "—"}
            series={series}
            accent="fuchsia"
            caption="events per user"
          />
          <StatCard
            label="Avg sessions / user"
            value={stats.avgSessionsPerUser ?? "—"}
            accent="amber"
            caption="sessions per user"
          />
          <StatCard
            label="Avg session"
            value={fmtDuration(stats.avgSessionSec)}
            accent="green"
            caption="time in app"
          />
        </div>

        {/* secondary metrics */}
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {[
            ["DAU", stats.dau],
            ["MAU", stats.mau],
            ["Events 24h", stats.events24h],
            ["Sessions 24h", stats.sessions24h],
          ].map(([label, val]) => (
            <div key={label} className="card flex items-center justify-between p-4">
              <span className="text-sm text-ink-soft">{label}</span>
              <span className="font-display text-lg font-bold tabular-nums">
                {Number(val).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          {/* daily chart */}
          <section className="card p-5">
            <h2 className="font-display font-bold">Events / day</h2>
            <p className="text-xs text-ink-mute">last 14 days</p>
            <div className="mt-5 flex h-40 items-end gap-1.5">
              {stats.daily.map((d) => (
                <div
                  key={d.day}
                  className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  <div
                    className="w-full rounded-t-md transition group-hover:opacity-80"
                    style={{
                      height: `${4 + (d.count / maxDaily) * 120}px`,
                      background:
                        "linear-gradient(180deg, var(--fuchsia), var(--violet))",
                    }}
                    title={`${d.day}: ${d.count}`}
                  />
                  <span className="text-[9px] text-ink-mute">{d.day.slice(8)}</span>
                </div>
              ))}
              {stats.daily.length === 0 && (
                <p className="text-sm text-ink-mute">No data yet.</p>
              )}
            </div>
          </section>

          {/* top events */}
          <section className="card p-5">
            <h2 className="font-display font-bold">Top events</h2>
            <div className="mt-4 space-y-3">
              {stats.topEvents.map((e) => {
                const max = Math.max(1, ...stats.topEvents.map((x) => x.count));
                const share = topEventTotal
                  ? Math.round((e.count / topEventTotal) * 100)
                  : 0;
                return (
                  <div key={e.name}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-mono text-xs">{e.name}</span>
                      <span className="tabular-nums text-ink-soft">
                        {e.count.toLocaleString()}
                        <span className="ml-1.5 text-xs text-ink-mute">{share}%</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(e.count / max) * 100}%`,
                          background:
                            "linear-gradient(90deg, var(--violet), var(--fuchsia))",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {stats.topEvents.length === 0 && (
                <p className="text-sm text-ink-mute">No events yet.</p>
              )}
            </div>
          </section>
        </div>

        {/* geo */}
        {hasGeo && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="font-display font-bold">Top countries</h2>
              <p className="text-xs text-ink-mute">
                {geo.knownCountryUsers.toLocaleString()} users with location
              </p>
              <div className="mt-4 space-y-3">
                {geo.countries.map((c) => {
                  const max = Math.max(1, ...geo.countries.map((x) => x.users));
                  return (
                    <div key={c.code}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="text-base leading-none">
                            {flagEmoji(c.code)}
                          </span>
                          {countryName(c.code)}
                        </span>
                        <span className="tabular-nums text-ink-soft">
                          {c.users.toLocaleString()}
                          <span className="ml-1 text-xs text-ink-mute">
                            user{c.users === 1 ? "" : "s"}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(c.users / max) * 100}%`,
                            background:
                              "linear-gradient(90deg, var(--violet), var(--fuchsia))",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {geo.countries.length === 0 && (
                  <p className="text-sm text-ink-mute">No country data yet.</p>
                )}
              </div>
            </section>

            <section className="card p-5">
              <h2 className="font-display font-bold">Top languages</h2>
              <p className="text-xs text-ink-mute">by users</p>
              <div className="mt-4 space-y-3">
                {geo.languages.map((l) => {
                  const max = Math.max(1, ...geo.languages.map((x) => x.users));
                  return (
                    <div key={l.code}>
                      <div className="flex justify-between text-sm">
                        <span>
                          {langName(l.code)}{" "}
                          <span className="font-mono text-xs text-ink-mute">
                            {l.code}
                          </span>
                        </span>
                        <span className="tabular-nums text-ink-soft">
                          {l.users.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(l.users / max) * 100}%`,
                            background:
                              "linear-gradient(90deg, var(--fuchsia), var(--amber))",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {geo.languages.length === 0 && (
                  <p className="text-sm text-ink-mute">No language data yet.</p>
                )}
              </div>
            </section>
          </div>
        )}

        {/* users */}
        <section id="users" className="card mt-6 overflow-hidden scroll-mt-6">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-display font-bold">Users</h2>
              <p className="mt-0.5 text-xs text-ink-mute">
                {users.length.toLocaleString()} shown · sorted by{" "}
                <span className="text-ink-soft">{SORT_LABELS[sort]}</span> (
                {dir === "asc" ? "ascending" : "descending"})
              </p>
            </div>
            <span className="hidden text-xs text-ink-mute sm:inline">
              click a column to sort
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-mute">
                  <th className="px-5 py-3 text-left font-semibold">User</th>
                  {(
                    [
                      ["events", "Events"],
                      ["sessions", "Sessions"],
                      ["time", "Time"],
                      ["first", "First seen"],
                      ["last", "Last seen"],
                    ] as const
                  ).map(([col, label]) => {
                    const isActive = sort === col;
                    return (
                      <th key={col} className="px-5 py-3 text-right font-semibold">
                        <Link
                          href={sortHref(col)}
                          scroll={false}
                          className={
                            "inline-flex items-center gap-1 transition hover:text-ink " +
                            (isActive ? "text-violet" : "")
                          }
                        >
                          {label}
                          <span className="w-2 text-[10px]">{sortArrow(col)}</span>
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {users.map((u, i) => (
                  <tr key={u.uid} className="group transition hover:bg-ink/[0.025]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-mute">
                          {i + 1}
                        </span>
                        <Link
                          href={`/apps/${app.slug}/users/${encodeURIComponent(u.uid)}?token=${token}`}
                          className="flex items-center gap-2 font-mono text-xs text-violet group-hover:underline"
                        >
                          <span
                            className="text-sm leading-none"
                            title={u.country ? countryName(u.country) : "Unknown"}
                          >
                            {flagEmoji(u.country)}
                          </span>
                          {u.uid.length > 26 ? u.uid.slice(0, 26) + "…" : u.uid}
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums">
                      {u.events.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-soft">
                      {u.sessions.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-soft">
                      {fmtDuration(u.totalSec)}
                    </td>
                    <td
                      className="px-5 py-3 text-right text-xs text-ink-mute"
                      title={u.firstSeen.slice(0, 10)}
                    >
                      {fmtRelative(u.firstSeen, now)}
                    </td>
                    <td
                      className="px-5 py-3 text-right text-xs text-ink-soft"
                      title={u.lastSeen.slice(0, 10)}
                    >
                      {fmtRelative(u.lastSeen, now)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <p className="px-5 py-4 text-sm text-ink-mute">
                No identified users yet (events arriving without a{" "}
                <code className="font-mono">uid</code>).
              </p>
            )}
          </div>
        </section>
      </div>
    </Shell>
  );
}
