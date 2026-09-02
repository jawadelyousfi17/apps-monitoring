"use client";

import { useState } from "react";

export type DailyUserPoint = {
  day: string;
  count: number;
  dateFormatted: string;
  weekday: string;
};

export default function DailyUsersChart({
  data,
  totalUsers,
}: {
  data: DailyUserPoint[];
  totalUsers: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const counts = data.map((d) => d.count);
  const maxCount = Math.max(1, ...counts);
  const totalPeriodUsers = counts.reduce((acc, c) => acc + c, 0);
  const avgUsersPerDay = data.length ? Math.round(totalPeriodUsers / data.length) : 0;

  // Find peak day
  let peakIdx = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i].count > data[peakIdx].count) peakIdx = i;
  }
  const peakDay = data[peakIdx];

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="card relative overflow-hidden p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-8 w-8 place-items-center rounded-lg text-white"
              style={{ background: "linear-gradient(135deg, var(--violet), var(--fuchsia))" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">Active Users / Day</h2>
              <p className="text-xs text-ink-mute">
                Unique daily active users across the last 14 days
              </p>
            </div>
          </div>
        </div>

        {/* Quick Highlights */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-line bg-panel-2 px-3.5 py-1.5 text-right">
            <span className="text-[10px] font-medium uppercase tracking-wider text-ink-mute">
              Daily Avg
            </span>
            <div className="font-display text-base font-bold tabular-nums text-ink">
              {avgUsersPerDay.toLocaleString()}
            </div>
          </div>

          {peakDay && peakDay.count > 0 && (
            <div className="rounded-xl border border-fuchsia/20 bg-fuchsia/5 px-3.5 py-1.5 text-right">
              <span className="text-[10px] font-medium uppercase tracking-wider text-fuchsia">
                Peak ({peakDay.dateFormatted})
              </span>
              <div className="font-display text-base font-bold tabular-nums text-fuchsia">
                {peakDay.count.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="relative mt-6">
        {/* Hover info banner */}
        <div className="mb-3 flex h-6 items-center justify-between text-xs">
          {hovered ? (
            <div className="flex items-center gap-2 animate-in fade-in duration-150">
              <span className="font-semibold text-ink">
                {hovered.weekday}, {hovered.dateFormatted}
              </span>
              <span className="text-ink-mute">·</span>
              <span className="rounded-md bg-violet/10 px-2 py-0.5 font-mono font-bold text-violet">
                {hovered.count.toLocaleString()} unique user{hovered.count === 1 ? "" : "s"}
              </span>
              {maxCount > 0 && (
                <span className="text-ink-mute">
                  ({Math.round((hovered.count / maxCount) * 100)}% of peak)
                </span>
              )}
            </div>
          ) : (
            <span className="text-ink-mute">Hover over a day to inspect</span>
          )}
          <span className="font-mono text-[11px] text-ink-mute">
            Max: {maxCount.toLocaleString()} users
          </span>
        </div>

        {/* Chart Grid & Bars */}
        <div className="relative h-64 sm:h-72 w-full pt-4">
          {/* Background horizontal guide lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
            <div className="border-b border-dashed border-line w-full" />
            <div className="border-b border-dashed border-line w-full" />
            <div className="border-b border-dashed border-line w-full" />
            <div className="border-b border-line w-full" />
          </div>

          {/* Vertical Bars */}
          <div className="relative z-10 flex h-full items-end gap-2 sm:gap-3 px-1">
            {data.map((d, idx) => {
              const isPeak = idx === peakIdx && d.count > 0;
              const isHovered = hoveredIdx === idx;
              const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
              // Minimum height so bar is always visible even with 0
              const minHeightPx = 6;
              const calcHeight = d.count > 0 ? `calc(${pct}% * 0.9 + 8px)` : `${minHeightPx}px`;

              return (
                <div
                  key={d.day}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end cursor-pointer"
                >
                  {/* Top value on bar hover or peak */}
                  {(isHovered || isPeak) && (
                    <span
                      className={
                        "absolute -top-7 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold transition shadow-sm z-20 pointer-events-none " +
                        (isHovered
                          ? "bg-ink text-white"
                          : "bg-fuchsia text-white")
                      }
                    >
                      {d.count}
                    </span>
                  )}

                  {/* Bar */}
                  <div
                    className={
                      "w-full rounded-t-lg transition-all duration-200 " +
                      (isHovered
                        ? "brightness-110 shadow-lg scale-y-[1.02] origin-bottom"
                        : "group-hover:opacity-90")
                    }
                    style={{
                      height: calcHeight,
                      background: isPeak
                        ? "linear-gradient(180deg, var(--fuchsia), var(--violet))"
                        : d.count > 0
                          ? "linear-gradient(180deg, var(--violet), rgba(124, 58, 237, 0.65))"
                          : "var(--line)",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* X-Axis labels (Date and weekday) */}
        <div className="mt-3 flex items-center justify-between gap-2 sm:gap-3 px-1 border-t border-line pt-2.5">
          {data.map((d, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <div
                key={d.day}
                className={
                  "flex flex-1 flex-col items-center text-center transition " +
                  (isHovered ? "text-violet font-semibold" : "text-ink-mute")
                }
              >
                <span className="text-[10px] sm:text-[11px] font-mono leading-tight">
                  {d.weekday}
                </span>
                <span className="text-[9px] sm:text-[10px] tabular-nums text-ink-soft">
                  {d.dateFormatted.slice(4)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
