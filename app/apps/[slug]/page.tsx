import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminTokens } from "@/lib/auth";
import {
  getAppStats,
  listAppUsers,
  listAppsWithCounts,
  listAppGeo,
} from "@/lib/stats";
import { fmtDuration, flagEmoji, countryName, langName } from "@/lib/format";
import { Shell, Crumb } from "@/app/_components/Shell";
import { StatCard } from "@/app/_components/StatCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AppPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ slug }, { token }] = await Promise.all([params, searchParams]);
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

  const [stats, users, apps, geo] = await Promise.all([
    getAppStats(app.id, new Date()),
    listAppUsers(app.id, 100),
    listAppsWithCounts(),
    listAppGeo(app.id),
  ]);
  const hasGeo = geo.countries.length > 0 || geo.languages.length > 0;

  const series = stats.daily.map((d) => d.count);
  const maxDaily = Math.max(1, ...series);

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
                return (
                  <div key={e.name}>
                    <div className="flex justify-between text-sm">
                      <span className="font-mono text-xs">{e.name}</span>
                      <span className="tabular-nums text-ink-soft">
                        {e.count.toLocaleString()}
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
        <section className="card mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-display font-bold">Users</h2>
            <span className="text-xs text-ink-mute">top {users.length} by events</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-mute">
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 text-right font-semibold">Events</th>
                  <th className="px-5 py-3 text-right font-semibold">Sessions</th>
                  <th className="px-5 py-3 text-right font-semibold">Time</th>
                  <th className="px-5 py-3 text-right font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {users.map((u) => (
                  <tr key={u.uid} className="transition hover:bg-ink/[0.02]">
                    <td className="px-5 py-3">
                      <Link
                        href={`/apps/${app.slug}/users/${encodeURIComponent(u.uid)}?token=${token}`}
                        className="flex items-center gap-2 font-mono text-xs text-violet hover:underline"
                      >
                        <span
                          className="text-sm leading-none"
                          title={u.country ? countryName(u.country) : "Unknown"}
                        >
                          {flagEmoji(u.country)}
                        </span>
                        {u.uid.length > 26 ? u.uid.slice(0, 26) + "…" : u.uid}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">
                      {u.events.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-soft">
                      {u.sessions}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-soft">
                      {fmtDuration(u.totalSec)}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-ink-mute">
                      {u.lastSeen.slice(0, 10)}
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
