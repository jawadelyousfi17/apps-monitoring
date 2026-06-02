"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type AdminApp = {
  id: string;
  name: string;
  slug: string;
  apiKey: string;
  eventCount: number;
};

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminApps({
  apps,
  token,
}: {
  apps: AdminApp[];
  token: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function api(path: string, method: string, body?: unknown) {
    const res = await fetch(`/api/apps${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data;
  }

  function run(fn: () => Promise<void>) {
    setError(null);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    const finalSlug = slug || slugify(name);
    run(async () => {
      await api("", "POST", { name, slug: finalSlug });
      setName("");
      setSlug("");
      setSlugTouched(false);
    });
  }

  function regenerate(id: string) {
    if (!confirm("Regenerate key? Old key stops working immediately.")) return;
    run(() => api(`/${id}`, "PATCH", { regenerateKey: true }).then(() => {}));
  }

  function rename(id: string, current: string) {
    const next = prompt("New name", current);
    if (!next || next.trim() === current) return;
    run(() => api(`/${id}`, "PATCH", { name: next.trim() }).then(() => {}));
  }

  function remove(id: string, appName: string) {
    if (!confirm(`Delete "${appName}" and ALL its events/sessions? Cannot undo.`))
      return;
    run(() => api(`/${id}`, "DELETE").then(() => {}));
  }

  const inputCls =
    "rounded-xl border border-line bg-panel-2 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet/40 focus:bg-panel focus:ring-4 focus:ring-violet/10";

  return (
    <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
      {/* create */}
      <form
        onSubmit={create}
        className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-soft">App name</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="Video Editor"
            required
            className={inputCls}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-soft">Slug</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="video-editor"
            required
            className={`${inputCls} font-mono`}
          />
        </label>
        <button
          type="submit"
          disabled={pending || !name}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, var(--violet), var(--fuchsia))" }}
        >
          + Create app
        </button>
      </form>

      {error && (
        <p
          className="mt-3 rounded-xl px-3.5 py-2.5 text-sm font-medium"
          style={{ color: "var(--red)", background: "var(--red-bg)" }}
        >
          {error}
        </p>
      )}

      {/* app cards */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {apps.map((a) => (
          <AppCard
            key={a.id}
            app={a}
            token={token}
            onRename={() => rename(a.id, a.name)}
            onRegenerate={() => regenerate(a.id)}
            onRemove={() => remove(a.id, a.name)}
          />
        ))}
        {apps.length === 0 && (
          <p className="text-sm text-ink-mute">No apps yet. Create one above.</p>
        )}
      </div>
    </div>
  );
}

function AppCard({
  app,
  token,
  onRename,
  onRegenerate,
  onRemove,
}: {
  app: AdminApp;
  token: string;
  onRename: () => void;
  onRegenerate: () => void;
  onRemove: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(app.apiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  const masked = app.apiKey.slice(0, 10) + "…" + app.apiKey.slice(-4);
  const initial = app.name.charAt(0).toUpperCase();
  const btn =
    "rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-ink/[0.04] hover:text-ink";

  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl font-display text-base font-bold text-white"
            style={{ background: "linear-gradient(135deg, var(--violet), var(--fuchsia))" }}
          >
            {initial}
          </span>
          <div>
            <Link
              href={`/apps/${app.slug}?token=${token}`}
              className="font-display font-bold tracking-tight hover:underline"
            >
              {app.name}
            </Link>
            <div className="font-mono text-xs text-ink-mute">{app.slug}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl font-bold tabular-nums">
            {app.eventCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-ink-mute">events</div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-panel-2 px-3 py-2 font-mono text-xs">
        <span className="flex-1 truncate text-ink-soft">
          {revealed ? app.apiKey : masked}
        </span>
        <button
          onClick={() => setRevealed((v) => !v)}
          className="shrink-0 font-sans font-medium text-ink-mute hover:text-ink"
        >
          {revealed ? "Hide" : "Reveal"}
        </button>
        <button
          onClick={copy}
          className="shrink-0 font-sans font-medium text-violet hover:opacity-80"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/apps/${app.slug}?token=${token}`}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--ink)" }}
        >
          Analytics →
        </Link>
        <button onClick={onRename} className={btn}>
          Rename
        </button>
        <button onClick={onRegenerate} className={btn}>
          Regenerate key
        </button>
        <button
          onClick={onRemove}
          className="rounded-lg border px-2.5 py-1.5 text-xs font-medium transition"
          style={{ borderColor: "var(--red-bg)", color: "var(--red)" }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
