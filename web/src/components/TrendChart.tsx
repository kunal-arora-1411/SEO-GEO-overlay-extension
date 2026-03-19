"use client";

interface TrendChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  labels?: string[];
}

export default function TrendChart({
  data,
  width = 200,
  height = 60,
  color = "#7c3aed",
  showDots = false,
  labels,
}: TrendChartProps) {
  if (data.length < 2) return null;

  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const minVal = Math.min(...data) * 0.9;
  const maxVal = Math.max(...data) * 1.1 || 1;
  const range = maxVal - minVal || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - minVal) / range) * chartHeight;
    return { x, y, value };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Gradient area path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  const trend = data[data.length - 1] - data[0];
  const trendColor = trend >= 0 ? "#22c55e" : "#ef4444";

  return (
    <div className="inline-flex flex-col items-center">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path d={areaD} fill={`url(#gradient-${color})`} />
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {showDots &&
          points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
          ))}
      </svg>
      {labels && (
        <div
          className="flex justify-between w-full mt-1"
          style={{ width }}
        >
          {labels.map((label, i) => (
            <span key={i} className="text-[10px] text-slate-400">
              {label}
            </span>
          ))}
        </div>
      )}
      {trend !== 0 && (
        <span className="text-xs font-medium mt-1" style={{ color: trendColor }}>
          {trend > 0 ? "+" : ""}
          {trend.toFixed(1)}
        </span>
      )}
    </div>
  );
}
