import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminTokens } from "@/lib/auth";
import { getUserDetail, listAppsWithCounts } from "@/lib/stats";
import {
  fmtDuration,
  fmtDateTime,
  flagEmoji,
  countryName,
  langName,
} from "@/lib/format";
import { Shell, Crumb } from "@/app/_components/Shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-xs font-medium text-ink-soft">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <div className="text-sm font-medium text-ink-soft">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; uid: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ slug, uid: rawUid }, { token }] = await Promise.all([
    params,
    searchParams,
  ]);
  const ok =
    adminTokens().length > 0 && !!token && adminTokens().includes(token);
  if (!ok) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-ink-soft">
        Invalid or missing token.
      </div>
    );
  }

  const uid = decodeURIComponent(rawUid);
  const [app, apps] = await Promise.all([
    prisma.app.findUnique({ where: { slug } }),
    listAppsWithCounts(),
  ]);
  if (!app) notFound();

  const detail = await getUserDetail(app.id, uid);
  if (!detail) notFound();

  const maxBreak = Math.max(1, ...detail.breakdown.map((b) => b.count));

  return (
    <Shell
      token={token!}
      active={app.slug}
      apps={apps.map((a) => ({ slug: a.slug, name: a.name }))}
      breadcrumb={<Crumb items={["Apps Monitoring", app.name, "User"]} />}
    >
      <div className="rise mx-auto max-w-5xl">
        <Link
          href={`/apps/${slug}?token=${token}`}
          className="text-sm text-ink-soft hover:text-ink"
        >
          ← {app.name}
        </Link>
        <h1 className="mt-3 flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
          <span title={detail.geo.country ? countryName(detail.geo.country) : "Unknown"}>
            {flagEmoji(detail.geo.country)}
          </span>
          User
        </h1>
        <div className="mt-1 break-all font-mono text-xs text-ink-mute">{uid}</div>

        {(detail.geo.country || detail.geo.lang || detail.geo.tz) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.geo.country && (
              <Chip>
                {flagEmoji(detail.geo.country)} {countryName(detail.geo.country)}
              </Chip>
            )}
            {detail.geo.lang && <Chip>🗣 {langName(detail.geo.lang)}</Chip>}
            {detail.geo.tz && <Chip>🕘 {detail.geo.tz}</Chip>}
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Events" value={detail.totalEvents.toLocaleString()} />
          <Stat label="Sessions" value={detail.sessions.toLocaleString()} />
          <Stat label="Total time" value={fmtDuration(detail.totalSec)} />
          <Stat
            label="Avg session"
            value={
              detail.sessions
                ? fmtDuration(Math.round(detail.totalSec / detail.sessions))
                : "—"
            }
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-xs text-ink-mute">
          <span>First seen: {fmtDateTime(detail.firstSeen)}</span>
          <span>Last seen: {fmtDateTime(detail.lastSeen)}</span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="font-display font-bold">Events by type</h2>
            <div className="mt-4 space-y-3">
              {detail.breakdown.map((e) => (
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
                        width: `${(e.count / maxBreak) * 100}%`,
                        background:
                          "linear-gradient(90deg, var(--violet), var(--fuchsia))",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-display font-bold">
              Recent events{" "}
              <span className="font-sans text-xs font-normal text-ink-mute">
                last {detail.recent.length}
              </span>
            </h2>
            <div className="mt-3 max-h-[360px] space-y-1 overflow-y-auto">
              {detail.recent.map((e, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg px-2 py-1.5 hover:bg-ink/[0.02]"
                >
                  <span className="font-mono text-xs font-medium">{e.name}</span>
                  <span className="text-[11px] text-ink-mute">
                    {fmtDateTime(e.ts)}
                  </span>
                  {e.props != null && (
                    <code className="text-[11px] text-ink-soft">
                      {JSON.stringify(e.props)}
                    </code>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
