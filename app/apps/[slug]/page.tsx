import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminTokens } from "@/lib/auth";
import { getAppStats } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

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
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-neutral-500">Invalid or missing token.</p>
      </main>
    );
  }

  const app = await prisma.app.findUnique({ where: { slug } });
  if (!app) notFound();

  const stats = await getAppStats(app.id, new Date());
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.count));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href={`/?token=${token}`}
        className="text-sm text-neutral-500 hover:underline"
      >
        ← all apps
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{app.name}</h1>
      <div className="mt-1 font-mono text-xs text-neutral-400">{app.slug}</div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total events" value={stats.totalEvents.toLocaleString()} />
        <Stat label="Events 24h" value={stats.events24h.toLocaleString()} />
        <Stat label="Events 7d" value={stats.events7d.toLocaleString()} />
        <Stat label="Sessions 24h" value={stats.sessions24h.toLocaleString()} />
        <Stat label="DAU" value={stats.dau.toLocaleString()} />
        <Stat label="MAU" value={stats.mau.toLocaleString()} />
        <Stat label="Avg session" value={fmtDuration(stats.avgSessionSec)} />
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-neutral-500">
          Events / day (14d)
        </h2>
        <div className="mt-3 flex h-32 items-end gap-1">
          {stats.daily.map((d) => (
            <div
              key={d.day}
              className="flex-1 rounded-t bg-neutral-800 dark:bg-neutral-300"
              style={{ height: `${(d.count / maxDaily) * 100}%` }}
              title={`${d.day}: ${d.count}`}
            />
          ))}
          {stats.daily.length === 0 && (
            <p className="text-sm text-neutral-500">No data yet.</p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-neutral-500">Top events</h2>
        <div className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
          {stats.topEvents.map((e) => (
            <div key={e.name} className="flex justify-between py-2 text-sm">
              <span className="font-mono">{e.name}</span>
              <span className="tabular-nums text-neutral-500">
                {e.count.toLocaleString()}
              </span>
            </div>
          ))}
          {stats.topEvents.length === 0 && (
            <p className="py-2 text-sm text-neutral-500">No events yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
