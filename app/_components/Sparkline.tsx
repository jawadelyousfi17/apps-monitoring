// Inline SVG sparkline with soft area fill. Pure, server-renderable.
export function Sparkline({
  data,
  stroke = "var(--violet)",
  fill = "rgba(124,58,237,0.12)",
  width = 132,
  height = 44,
}: {
  data: number[];
  stroke?: string;
  fill?: string;
  width?: number;
  height?: number;
}) {
  const pts = data.length ? data : [0, 0];
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const span = max - min || 1;
  const stepX = pts.length > 1 ? width / (pts.length - 1) : 0;
  const pad = 4;
  const h = height - pad * 2;

  const coords = pts.map((v, i) => {
    const x = i * stepX;
    const y = pad + h - ((v - min) / span) * h;
    return [x, y] as const;
  });

  const line = coords
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <path d={area} fill={fill} stroke="none" />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.length > 0 && (
        <circle
          cx={coords[coords.length - 1][0]}
          cy={coords[coords.length - 1][1]}
          r={3}
          fill={stroke}
        />
      )}
    </svg>
  );
}

export function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold"
      style={{
        color: up ? "var(--green)" : "var(--red)",
        background: up ? "var(--green-bg)" : "var(--red-bg)",
      }}
    >
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}
