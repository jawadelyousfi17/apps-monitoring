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

  function refresh() {
    start(() => router.refresh());
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const finalSlug = slug || slugify(name);
    start(async () => {
      try {
        await api("", "POST", { name, slug: finalSlug });
        setName("");
        setSlug("");
        setSlugTouched(false);
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function regenerate(id: string) {
    if (!confirm("Regenerate key? Old key stops working immediately.")) return;
    start(async () => {
      try {
        await api(`/${id}`, "PATCH", { regenerateKey: true });
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function rename(id: string, current: string) {
    const next = prompt("New name", current);
    if (!next || next.trim() === current) return;
    start(async () => {
      try {
        await api(`/${id}`, "PATCH", { name: next.trim() });
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function remove(id: string, appName: string) {
    if (!confirm(`Delete "${appName}" and ALL its events/sessions? Cannot undo.`))
      return;
    start(async () => {
      try {
        await api(`/${id}`, "DELETE");
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <form
        onSubmit={create}
        className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 sm:flex-row sm:items-end dark:border-neutral-800"
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">App name</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="Video Editor"
            required
            className="rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">Slug</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="video-editor"
            required
            className="rounded-md border border-neutral-300 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !name}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Create app
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-3">
        {apps.map((a) => (
          <AppRow
            key={a.id}
            app={a}
            token={token}
            onRename={() => rename(a.id, a.name)}
            onRegenerate={() => regenerate(a.id)}
            onRemove={() => remove(a.id, a.name)}
          />
        ))}
        {apps.length === 0 && (
          <p className="text-sm text-neutral-500">No apps yet. Create one above.</p>
        )}
      </div>
    </div>
  );
}

function AppRow({
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

  const masked = app.apiKey.slice(0, 8) + "…" + app.apiKey.slice(-4);

  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">{app.name}</div>
          <div className="font-mono text-xs text-neutral-400">
            {app.slug} · {app.eventCount.toLocaleString()} events
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href={`/apps/${app.slug}?token=${token}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Analytics
          </Link>
          <button
            onClick={onRename}
            className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Rename
          </button>
          <button
            onClick={onRegenerate}
            className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Regenerate key
          </button>
          <button
            onClick={onRemove}
            className="rounded-md border border-red-300 px-3 py-1.5 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-md bg-neutral-100 px-3 py-2 font-mono text-xs dark:bg-neutral-900">
        <span className="flex-1 truncate">{revealed ? app.apiKey : masked}</span>
        <button
          onClick={() => setRevealed((v) => !v)}
          className="shrink-0 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          {revealed ? "Hide" : "Reveal"}
        </button>
        <button
          onClick={copy}
          className="shrink-0 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
