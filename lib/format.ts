export function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 19) + "Z";
}

// Compact relative time vs `now` (e.g. "3h ago", "5d ago", "2mo ago").
export function fmtRelative(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const diff = now.getTime() - Date.parse(iso);
  if (Number.isNaN(diff)) return "—";
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

// ISO 3166-1 alpha-2 → flag emoji (regional indicator letters).
export function flagEmoji(code: string | null): string {
  if (!code || code.length !== 2 || !/^[A-Za-z]{2}$/.test(code)) return "🌐";
  const cc = code.toUpperCase();
  return String.fromCodePoint(
    ...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

let regionNames: Intl.DisplayNames | null = null;
let langNames: Intl.DisplayNames | null = null;

export function countryName(code: string | null): string {
  if (!code) return "Unknown";
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function langName(code: string | null): string {
  if (!code) return "Unknown";
  try {
    langNames ??= new Intl.DisplayNames(["en"], { type: "language" });
    return langNames.of(code) ?? code;
  } catch {
    return code;
  }
}
