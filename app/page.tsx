import { adminTokens } from "@/lib/auth";
import { getOverview, listAppsWithCounts } from "@/lib/stats";
import { fmtDuration } from "@/lib/format";
import AdminApps from "@/app/_components/AdminApps";
import { Shell, Crumb } from "@/app/_components/Shell";
import { StatCard } from "@/app/_components/StatCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const ok = adminTokens().length > 0 && !!token && adminTokens().includes(token);

  if (!ok) {
    return <Gate />;
  }

  const [overview, apps] = await Promise.all([
    getOverview(new Date()),
    listAppsWithCounts(),
  ]);

  return (
    <Shell
      token={token!}
      active="overview"
      apps={apps.map((a) => ({ slug: a.slug, name: a.name }))}
      breadcrumb={<Crumb items={["Apps Monitoring", "Overview"]} />}
    >
      <div className="rise mx-auto max-w-6xl">
        <p className="font-display text-lg font-medium text-ink-soft">
          Your total events
        </p>
        <h1 className="grad-text font-display text-6xl font-extrabold tracking-tight sm:text-7xl">
          {overview.totalEvents.toLocaleString()}
        </h1>
        <p className="mt-1 text-sm text-ink-mute">
          across {overview.totalApps} app{overview.totalApps === 1 ? "" : "s"} ·{" "}
          {overview.totalUsers.toLocaleString()} users tracked
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Events"
            value={overview.events7d.toLocaleString()}
            delta={overview.eventsDelta}
            series={overview.daily}
            accent="violet"
          />
          <StatCard
            label="Active users"
            value={overview.users7d.toLocaleString()}
            delta={overview.usersDelta}
            series={overview.daily}
            accent="fuchsia"
          />
          <StatCard
            label="Avg. session"
            value={fmtDuration(overview.avgSessionSec)}
            delta={overview.sessionsDelta}
            series={overview.daily}
            accent="amber"
            caption="sessions vs last week"
          />
        </div>

        <div className="mt-12">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-bold tracking-tight">
              Your apps
            </h2>
            <span className="text-sm text-ink-mute">
              {apps.length} total
            </span>
          </div>
          <div className="mt-5">
            <AdminApps
              token={token!}
              apps={apps.map((a) => ({
                id: a.id,
                name: a.name,
                slug: a.slug,
                apiKey: a.apiKey,
                eventCount: a.eventCount,
              }))}
            />
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Gate() {
  return (
    <div className="relative grid min-h-screen place-items-center px-6">
      <div className="ambient" />
      <div className="card relative z-10 w-full max-w-md p-8 text-center">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-2xl text-white"
          style={{ background: "linear-gradient(135deg, var(--violet), var(--fuchsia))" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
          </svg>
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold">Apps Monitoring</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Append <code className="font-mono">?token=YOUR_DASHBOARD_TOKEN</code> to
          the URL to open the admin dashboard.
        </p>
      </div>
    </div>
  );
}
