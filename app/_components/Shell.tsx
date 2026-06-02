import Link from "next/link";

type NavApp = { slug: string; name: string };

function Icon({ path }: { path: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  app: "M12 3l9 4.5-9 4.5-9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5",
  book: "M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 7h8M8 11h8",
};

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-ink/[0.05] text-ink"
          : "text-ink-soft hover:bg-ink/[0.035] hover:text-ink"
      }`}
    >
      <span className={active ? "text-violet" : "text-ink-mute"}>
        <Icon path={ICONS[icon]} />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Shell({
  token,
  active,
  apps = [],
  breadcrumb,
  children,
}: {
  token: string;
  active: "overview" | string;
  apps?: NavApp[];
  breadcrumb: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <div className="ambient" />
      <div className="relative z-10 flex">
        {/* sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-line bg-panel/70 px-4 py-5 backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-2.5 px-2">
            <span
              className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-sm"
              style={{
                background:
                  "linear-gradient(135deg, var(--violet), var(--fuchsia))",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
              </svg>
            </span>
            <div className="leading-tight">
              <div className="font-display text-sm font-bold">Apps Monitoring</div>
              <div className="text-[11px] text-ink-mute">analytics</div>
            </div>
          </div>

          <nav className="mt-7 flex flex-col gap-1">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-mute">
              Main menu
            </div>
            <NavLink
              href={`/?token=${token}`}
              label="Overview"
              icon="home"
              active={active === "overview"}
            />
          </nav>

          {apps.length > 0 && (
            <nav className="mt-6 flex flex-col gap-1 overflow-y-auto">
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-mute">
                Apps
              </div>
              {apps.map((a) => (
                <NavLink
                  key={a.slug}
                  href={`/apps/${a.slug}?token=${token}`}
                  label={a.name}
                  icon="app"
                  active={active === a.slug}
                />
              ))}
            </nav>
          )}

          <div className="mt-auto rounded-2xl border border-line bg-panel-2 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="text-violet">
                <Icon path={ICONS.book} />
              </span>
              Integration guide
            </div>
            <p className="mt-1 text-xs text-ink-mute">
              See <span className="font-mono">INTEGRATION.md</span> to wire an app.
            </p>
          </div>
        </aside>

        {/* main */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-line bg-bg/70 px-6 py-4 backdrop-blur-xl sm:px-8">
            <div className="flex items-center gap-2 text-sm text-ink-soft">
              {breadcrumb}
            </div>
            <div className="hidden items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm text-ink-mute sm:flex">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.2-3.2" />
              </svg>
              <span className="w-40">Search…</span>
            </div>
          </header>
          <main className="px-6 py-8 sm:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function Crumb({ items }: { items: string[] }) {
  return (
    <>
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-ink-mute">/</span>}
          <span className={i === items.length - 1 ? "font-medium text-ink" : ""}>
            {it}
          </span>
        </span>
      ))}
    </>
  );
}
