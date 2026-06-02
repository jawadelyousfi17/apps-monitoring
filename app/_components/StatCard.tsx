import { Sparkline, Delta } from "./Sparkline";

type Accent = "violet" | "fuchsia" | "amber" | "green";

const ACCENTS: Record<Accent, { stroke: string; fill: string }> = {
  violet: { stroke: "var(--violet)", fill: "rgba(124,58,237,0.12)" },
  fuchsia: { stroke: "var(--fuchsia)", fill: "rgba(217,70,239,0.12)" },
  amber: { stroke: "var(--amber)", fill: "rgba(245,158,11,0.14)" },
  green: { stroke: "var(--green)", fill: "rgba(22,163,74,0.12)" },
};

export function StatCard({
  label,
  value,
  delta = null,
  series,
  accent = "violet",
  caption = "compared to last week",
}: {
  label: string;
  value: string | number;
  delta?: number | null;
  series?: number[];
  accent?: Accent;
  caption?: string;
}) {
  const a = ACCENTS[accent];
  return (
    <div className="card p-5">
      <div className="text-sm font-medium text-ink-soft">{label}</div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-3xl font-bold tracking-tight tabular-nums">
              {value}
            </span>
            <Delta pct={delta} />
          </div>
          <div className="mt-1 text-xs text-ink-mute">{caption}</div>
        </div>
        {series && series.length > 0 && (
          <Sparkline data={series} stroke={a.stroke} fill={a.fill} />
        )}
      </div>
    </div>
  );
}
