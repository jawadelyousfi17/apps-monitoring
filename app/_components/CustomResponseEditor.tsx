"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  type CustomField,
  type FieldType,
  castFieldValue,
  formatCustomResponseData,
} from "@/lib/custom-response";

export default function CustomResponseEditor({
  appId,
  appSlug,
  apiKey,
  initialFields,
  token,
}: {
  appId: string;
  appSlug: string;
  apiKey: string;
  initialFields: CustomField[];
  token: string;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<CustomField[]>(initialFields ?? []);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // New field inputs
  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState<FieldType>("text");
  const [newValue, setNewValue] = useState<string>("");

  async function persist(updated: CustomField[]) {
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ customResponse: updated }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleAddField(e: React.FormEvent) {
    e.preventDefault();
    const key = newKey.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!key) return;

    if (fields.some((f) => f.key.toLowerCase() === key.toLowerCase())) {
      setError(`A field named "${key}" already exists.`);
      return;
    }

    const casted = castFieldValue(
      newType,
      newType === "bool"
        ? newValue === "true" || newValue === ""
        : newValue,
    );

    const updated = [...fields, { key, type: newType, value: casted }];
    setFields(updated);
    setNewKey("");
    setNewValue("");
    persist(updated);
  }

  function handleUpdateValue(index: number, val: unknown) {
    const updated = [...fields];
    const field = updated[index];
    if (!field) return;

    field.value = castFieldValue(field.type, val);
    setFields(updated);
    persist(updated);
  }

  function handleRemoveField(index: number) {
    const field = fields[index];
    if (!field) return;
    if (!confirm(`Delete custom field "${field.key}"?`)) return;

    const updated = fields.filter((_, i) => i !== index);
    setFields(updated);
    persist(updated);
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const endpointUrl = `${origin}/api/config?key=${apiKey}`;
  const curlCmd = `curl "${endpointUrl}"`;

  const previewData = {
    ok: true,
    app: appSlug,
    data: formatCustomResponseData(fields),
    fields,
  };

  const inputCls =
    "rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm outline-none transition focus:border-violet/40 focus:bg-panel focus:ring-4 focus:ring-violet/10";

  return (
    <section className="card mt-8 overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold">Custom Response / Remote Config</h2>
            <span className="rounded-full bg-violet/10 px-2 py-0.5 text-xs font-semibold text-violet">
              GET /api/config
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-mute">
            Configure dynamic typed key-value pairs (text, bool, number) for this app to fetch at runtime.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(endpointUrl);
              setCopiedUrl(true);
              setTimeout(() => setCopiedUrl(false), 1500);
            }}
            className="rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-ink/[0.04] hover:text-ink"
          >
            {copiedUrl ? "Copied URL!" : "Copy Endpoint URL"}
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(curlCmd);
              setCopiedCurl(true);
              setTimeout(() => setCopiedCurl(false), 1500);
            }}
            className="rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-ink/[0.04] hover:text-ink"
          >
            {copiedCurl ? "Copied cURL!" : "Copy cURL"}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="mx-5 mt-4 rounded-xl px-3.5 py-2.5 text-sm font-medium"
          style={{ color: "var(--red)", background: "var(--red-bg)" }}
        >
          {error}
        </div>
      )}

      {/* Add Field Form */}
      <form onSubmit={handleAddField} className="border-b border-line bg-panel-2/50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">Field Key</span>
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="e.g. maintenance_mode, banner_text, max_export_sec"
              className={`${inputCls} font-mono`}
              required
            />
          </label>

          <label className="flex w-full flex-col gap-1.5 sm:w-36">
            <span className="text-xs font-semibold text-ink-soft">Type</span>
            <select
              value={newType}
              onChange={(e) => {
                const t = e.target.value as FieldType;
                setNewType(t);
                if (t === "bool") setNewValue("true");
                else if (t === "number") setNewValue("0");
                else setNewValue("");
              }}
              className={`${inputCls} font-medium`}
            >
              <option value="text">text (string)</option>
              <option value="bool">bool (boolean)</option>
              <option value="number">number</option>
              <option value="json">json</option>
            </select>
          </label>

          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">Value</span>
            {newType === "bool" ? (
              <select
                value={newValue || "true"}
                onChange={(e) => setNewValue(e.target.value)}
                className={`${inputCls} font-medium`}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : newType === "number" ? (
              <input
                type="number"
                step="any"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="0"
                className={`${inputCls} tabular-nums`}
              />
            ) : (
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter value..."
                className={inputCls}
              />
            )}
          </label>

          <button
            type="submit"
            disabled={pending || !newKey}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--violet), var(--fuchsia))" }}
          >
            + Add Field
          </button>
        </div>
      </form>

      {/* Fields List */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-mute">
              <th className="px-5 py-3 text-left font-semibold">Key</th>
              <th className="px-5 py-3 text-left font-semibold">Type</th>
              <th className="px-5 py-3 text-left font-semibold">Value</th>
              <th className="px-5 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {fields.map((f, idx) => (
              <tr key={f.key} className="group transition hover:bg-ink/[0.015]">
                <td className="px-5 py-3">
                  <span className="font-mono text-xs font-semibold text-ink">{f.key}</span>
                </td>
                <td className="px-5 py-3">
                  <TypeBadge type={f.type} />
                </td>
                <td className="px-5 py-3">
                  {f.type === "bool" ? (
                    <button
                      type="button"
                      onClick={() => handleUpdateValue(idx, !f.value)}
                      className={
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition " +
                        (f.value
                          ? "bg-green-500/15 text-green-600 hover:bg-green-500/25"
                          : "bg-red-500/15 text-red-600 hover:bg-red-500/25")
                      }
                    >
                      <span
                        className={
                          "h-2 w-2 rounded-full " +
                          (f.value ? "bg-green-500" : "bg-red-500")
                        }
                      />
                      {f.value ? "true" : "false"}
                    </button>
                  ) : f.type === "number" ? (
                    <input
                      type="number"
                      step="any"
                      defaultValue={String(f.value)}
                      onBlur={(e) => handleUpdateValue(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-32 rounded-lg border border-line bg-panel-2 px-2.5 py-1 font-mono text-xs tabular-nums outline-none focus:border-violet/40 focus:bg-panel"
                    />
                  ) : (
                    <input
                      type="text"
                      defaultValue={
                        typeof f.value === "object"
                          ? JSON.stringify(f.value)
                          : String(f.value ?? "")
                      }
                      onBlur={(e) => handleUpdateValue(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-full max-w-md rounded-lg border border-line bg-panel-2 px-2.5 py-1 text-xs outline-none focus:border-violet/40 focus:bg-panel"
                    />
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemoveField(idx)}
                    className="rounded-lg border px-2.5 py-1 text-xs font-medium transition hover:opacity-80"
                    style={{ borderColor: "var(--red-bg)", color: "var(--red)" }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {fields.length === 0 && (
          <div className="p-8 text-center text-sm text-ink-mute">
            No custom response fields configured for this app yet. Add one above.
          </div>
        )}
      </div>

      {/* Live JSON Preview */}
      <div className="border-t border-line bg-panel-2/30 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-soft">
            Live Response Preview ({curlCmd})
          </span>
          <span className="font-mono text-[11px] text-ink-mute">
            {fields.length} field{fields.length === 1 ? "" : "s"}
          </span>
        </div>
        <pre className="mt-2.5 max-h-48 overflow-auto rounded-xl bg-ink/[0.03] p-3.5 font-mono text-xs text-ink-soft">
          {JSON.stringify(previewData, null, 2)}
        </pre>
      </div>
    </section>
  );
}

function TypeBadge({ type }: { type: FieldType }) {
  switch (type) {
    case "bool":
      return (
        <span className="rounded-md border border-fuchsia/20 bg-fuchsia/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-fuchsia">
          bool
        </span>
      );
    case "number":
      return (
        <span className="rounded-md border border-amber/20 bg-amber/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-600">
          number
        </span>
      );
    case "json":
      return (
        <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-600">
          json
        </span>
      );
    case "text":
    default:
      return (
        <span className="rounded-md border border-violet/20 bg-violet/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-violet">
          text
        </span>
      );
  }
}
