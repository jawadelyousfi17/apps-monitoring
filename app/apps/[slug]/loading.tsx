// Streamed instantly on navigation into / between app dashboards. Mirrors the
// real page layout so the swap-in is seamless. See loading.js convention:
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md
export default function Loading() {
  return (
    <>
      <div className="topbar" aria-hidden />
      <div className="ambient" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8">
        {/* hero */}
        <div className="skel h-4 w-32" />
        <div className="skel mt-3 h-14 w-64" />
        <div className="skel mt-2 h-3 w-40" />
        <div className="skel mt-5 h-9 w-52 rounded-full" />

        {/* primary stat cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="skel h-3 w-20" />
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="skel h-8 w-16" />
                  <div className="skel mt-2 h-2.5 w-24" />
                </div>
                <div className="skel h-8 w-16" />
              </div>
            </div>
          ))}
        </div>

        {/* secondary metrics */}
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card flex items-center justify-between p-4">
              <div className="skel h-3 w-14" />
              <div className="skel h-4 w-10" />
            </div>
          ))}
        </div>

        {/* chart + top events */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="card p-5">
            <div className="skel h-4 w-28" />
            <div className="mt-5 flex h-40 items-end gap-1.5">
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  className="skel flex-1"
                  style={{ height: `${30 + ((i * 53) % 70)}%` }}
                />
              ))}
            </div>
          </div>
          <div className="card p-5">
            <div className="skel h-4 w-24" />
            <div className="mt-5 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <div className="skel h-3 w-full" />
                  <div className="skel mt-2 h-1.5 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* users table */}
        <div className="card mt-6 p-5">
          <div className="skel h-4 w-20" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skel h-6 w-full" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
