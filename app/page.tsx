import { adminTokens } from "@/lib/auth";
import { listAppsWithCounts } from "@/lib/stats";
import AdminApps from "@/app/_components/AdminApps";

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
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Apps Monitoring</h1>
        <p className="mt-4 text-sm text-neutral-500">
          Add <code>?token=YOUR_DASHBOARD_TOKEN</code> to the URL to open the
          admin dashboard.
        </p>
      </main>
    );
  }

  const apps = await listAppsWithCounts();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Apps Monitoring</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {apps.length} app{apps.length === 1 ? "" : "s"} tracked · admin
      </p>

      <div className="mt-8">
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
    </main>
  );
}
