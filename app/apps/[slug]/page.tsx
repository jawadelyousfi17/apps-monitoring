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
import DailyUsersChart from "@/app/_components/DailyUsersChart";
import CustomResponseEditor from "@/app/_components/CustomResponseEditor";
import { sanitizeCustomResponse } from "@/lib/custom-response";

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
    tab?: string;
  }>;
}) {
  const [
    { slug },
    { token, device: deviceParam, sort: sortParam, dir: dirParam, tab: tabParam },
  ] = await Promise.all([params, searchParams]);

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

  const currentTab = tabParam === "config" ? "config" : "analytics";
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
  const topEventTotal = stats.topEvents.reduce((s, e) => s + e.count, 0);

  const customFieldsCount = Array.isArray(app.customResponse)
    ? (app.customResponse as unknown[]).length
    : 0;

  // Helper to build URLs preserving token, tab, device
  const buildQs = (overrides: Record<string, string | undefined>): string => {
    const qs = new URLSearchParams({ token: token! });
    if (device !== "all") qs.set("device", device);
    if (currentTab !== "analytics") qs.set("tab", currentTab);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) qs.delete(k);
      else qs.set(k, v);
    }
    return qs.toString();
  };

  const sortHref = (col: UserSort): string => {
    const nextDir: SortDir = sort === col && dir === "desc" ? "asc" : "desc";
    return `/apps/${app.slug}?${buildQs({ sort: col, dir: nextDir })}#users`;
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
        {/* Header Title */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-lg font-medium text-ink-soft">{app.name}</p>
            <h1 className="grad-text font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
              {stats.totalUsers.toLocaleString()}{" "}
              <span className="text-3xl font-bold tracking-normal text-ink-soft sm:text-4xl">
                total users
              </span>
            </h1>
            <p className="mt-1 font-mono text-xs text-ink-mute">
              {app.slug} · {stats.totalEvents.toLocaleString()} total events
            </p>
          </div>
        </div>

        {/* Tab Switcher & Device Controls */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <Link
              href={`/apps/${app.slug}?${buildQs({ tab: "analytics" })}`}
              className={
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 font-display text-sm font-semibold transition " +
                (currentTab === "analytics"
                  ? "bg-ink text-white shadow-sm"
                  : "text-ink-soft hover:bg-panel-2 hover:text-ink")
              }
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
              Analytics
            </Link>

            <Link
              href={`/apps/${app.slug}?${buildQs({ tab: "config" })}`}
              className={
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 font-display text-sm font-semibold transition " +
                (currentTab === "config"
                  ? "bg-ink text-white shadow-sm"
                  : "text-ink-soft hover:bg-panel-2 hover:text-ink")
              }
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Remote Config
              {customFieldsCount > 0 && (
                <span className="rounded-full bg-violet/20 px-2 py-0.5 font-mono text-[11px] font-bold text-violet">
                  {customFieldsCount}
                </span>
              )}
            </Link>
          </div>

          {currentTab === "analytics" && (
            <div className="inline-flex rounded-full border border-line p-1 text-xs">
              {(
                [
                  ["all", "Both"],
                  ["ios", "iOS"],
                  ["android", "Android"],
                ] as const
              ).map(([val, label]) => {
                const activeTab = device === val;
                return (
                  <Link
                    key={val}
                    href={`/apps/${app.slug}?${buildQs({ device: val === "all" ? undefined : val })}`}
                    className={
                      "rounded-full px-3 py-1 font-medium transition " +
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
          )}
        </div>

        {/* TAB 1: Analytics */}
        {currentTab === "analytics" && (
          <div className="mt-6 space-y-6">
            {/* Primary Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="card flex flex-col justify-between p-5 border-l-4 border-l-green-500">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Today&apos;s Users
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-display text-3xl font-extrabold tabular-nums text-green-600">
                    {stats.todayUsers.toLocaleString()}
                  </span>
                  <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-600">
                    Active Today
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-mute">
                  Unique users since 00:00 UTC
                </p>
              </div>

              <div className="card flex flex-col justify-between p-5 border-l-4 border-l-fuchsia">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  This Month&apos;s Users
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-display text-3xl font-extrabold tabular-nums text-fuchsia">
                    {stats.monthUsers.toLocaleString()}
                  </span>
                  <span className="rounded-full bg-fuchsia/10 px-2 py-0.5 text-[11px] font-semibold text-fuchsia">
                    This Month
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-mute">
                  Unique users this calendar month
                </p>
              </div>

              <div className="card flex flex-col justify-between p-5 border-l-4 border-l-violet">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Total Users
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-display text-3xl font-extrabold tabular-nums text-ink">
                    {stats.totalUsers.toLocaleString()}
                  </span>
                  <span className="rounded-full bg-violet/10 px-2 py-0.5 text-[11px] font-semibold text-violet">
                    All-Time
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-mute">
                  Distinct identified uids
                </p>
              </div>

              <div className="card flex flex-col justify-between p-5 border-l-4 border-l-amber">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Avg. Session Time
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-display text-3xl font-extrabold tabular-nums text-amber-600">
                    {fmtDuration(stats.avgSessionSec)}
                  </span>
                  <span className="rounded-full bg-amber/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                    Duration
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-mute">
                  Average time per session
                </p>
              </div>
            </div>

            {/* MAIN HERO: Active Users / Day Graph */}
            <DailyUsersChart
              data={stats.dailyUsers}
              totalUsers={stats.totalUsers}
            />

            {/* Secondary Metrics Row */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {[
                ["DAU (24h)", stats.dau.toLocaleString()],
                ["MAU (30d)", stats.mau.toLocaleString()],
                ["Events (24h)", stats.events24h.toLocaleString()],
                ["Sessions (24h)", stats.sessions24h.toLocaleString()],
                ["Avg Events / User", stats.avgEventsPerUser ?? "—"],
                ["Avg Sessions / User", stats.avgSessionsPerUser ?? "—"],
              ].map(([label, val]) => (
                <div key={label} className="card p-3.5 flex flex-col justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-ink-mute">
                    {label}
                  </span>
                  <span className="font-display text-lg font-bold tabular-nums text-ink mt-1">
                    {val}
                  </span>
                </div>
              ))}
            </div>

            {/* Breakdown: Top Events & Geo */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Top Events */}
              <section className="card p-5">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div>
                    <h2 className="font-display font-bold">Top Events</h2>
                    <p className="text-xs text-ink-mute">Most frequent event actions</p>
                  </div>
                  <span className="font-mono text-xs text-ink-mute">
                    {stats.topEvents.length} distinct
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {stats.topEvents.map((e) => {
                    const max = Math.max(1, ...stats.topEvents.map((x) => x.count));
                    const share = topEventTotal
                      ? Math.round((e.count / topEventTotal) * 100)
                      : 0;
                    return (
                      <div key={e.name}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="font-mono text-xs font-semibold text-ink">{e.name}</span>
                          <span className="tabular-nums text-ink-soft">
                            {e.count.toLocaleString()}
                            <span className="ml-1.5 text-xs text-ink-mute">({share}%)</span>
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
                    <p className="text-sm text-ink-mute py-4 text-center">No events tracked yet.</p>
                  )}
                </div>
              </section>

              {/* Geo / Top Countries */}
              <section className="card p-5">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div>
                    <h2 className="font-display font-bold">Top Countries</h2>
                    <p className="text-xs text-ink-mute">
                      {geo.knownCountryUsers.toLocaleString()} users with location
                    </p>
                  </div>
                </div>

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
                            <span className="font-medium text-ink">{countryName(c.code)}</span>
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
                    <p className="text-sm text-ink-mute py-4 text-center">No country data yet.</p>
                  )}
                </div>
              </section>
            </div>

            {/* Users Table */}
            <section id="users" className="card overflow-hidden scroll-mt-6">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <h2 className="font-display font-bold">Users Directory</h2>
                  <p className="mt-0.5 text-xs text-ink-mute">
                    {users.length.toLocaleString()} users · sorted by{" "}
                    <span className="text-ink-soft font-semibold">{SORT_LABELS[sort]}</span> (
                    {dir === "asc" ? "ascending" : "descending"})
                  </p>
                </div>
                <span className="hidden text-xs text-ink-mute sm:inline">
                  click column header to sort
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
                                (isActive ? "text-violet font-bold" : "")
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
                  <p className="px-5 py-6 text-center text-sm text-ink-mute">
                    No identified users yet (events arriving without a{" "}
                    <code className="font-mono">uid</code>).
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: Remote Config / Custom Response */}
        {currentTab === "config" && (
          <div className="mt-6">
            <CustomResponseEditor
              appId={app.id}
              appSlug={app.slug}
              apiKey={app.apiKey}
              initialFields={sanitizeCustomResponse(app.customResponse)}
              token={token!}
            />
          </div>
        )}
      </div>
    </Shell>
  );
}