"use client";

import { useEffect, useState } from "react";

interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  animated?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#006c63"; // tertiary-500
  if (score >= 60) return "#712ae2"; // secondary-600
  if (score >= 40) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Needs Work";
  return "Poor";
}

export default function ScoreGauge({
  score,
  size = 120,
  strokeWidth = 6,
  label,
  animated = true,
}: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayScore / 100) * circumference;
  const color = getScoreColor(score);
  const gradientId = `gauge-gradient-${color.replace("#", "")}`;

  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }

    let current = 0;
    const step = score / 60;
    const timer = setInterval(() => {
      current += step;
      if (current >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [score, animated]);

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-surface-container-high"
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300 drop-shadow-sm"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-bold"
          style={{ color, fontSize: size * 0.22 }}
        >
          {displayScore}
        </span>
        <span
          className="text-surface-on-variant"
          style={{ fontSize: size * 0.08 }}
        >
          {getScoreLabel(score)}
        </span>
      </div>
      {label && (
        <span className="mt-3 font-display text-[13px] font-bold text-surface-on">{label}</span>
      )}
    </div>
  );
}
