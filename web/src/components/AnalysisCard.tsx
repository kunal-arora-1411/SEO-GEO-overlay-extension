"use client";

import Link from "next/link";
import ScoreGauge from "./ScoreGauge";
import type { Analysis } from "@/lib/api";

interface AnalysisCardProps {
  analysis: Analysis;
}

function getStatusBadge(status: Analysis["status"]) {
  const styles: Record<Analysis["status"], string> = {
    completed: "bg-green-50 text-green-700 border-green-200",
    processing: "bg-blue-50 text-blue-700 border-blue-200",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    failed: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncateUrl(url: string, maxLength: number = 40): string {
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + parsed.pathname;
    return display.length > maxLength
      ? display.substring(0, maxLength) + "..."
      : display;
  } catch {
    return url.length > maxLength ? url.substring(0, maxLength) + "..." : url;
  }
}

export default function AnalysisCard({ analysis }: AnalysisCardProps) {
  return (
    <Link
      href={`/dashboard/history`}
      className="card group flex items-center gap-6 transition-shadow hover:shadow-md"
    >
      <ScoreGauge
        score={analysis.overall_score}
        size={72}
        strokeWidth={6}
        animated={false}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <h3 className="font-display truncate text-base font-bold text-surface-on group-hover:text-primary-600 transition-colors">
            {truncateUrl(analysis.url)}
          </h3>
          {getStatusBadge(analysis.status)}
        </div>
        <p className="mt-1.5 text-sm text-surface-on-variant">
          Keyword: <span className="font-semibold text-surface-on">{analysis.keyword}</span>
        </p>
        <div className="mt-3 flex items-center gap-5 text-sm font-medium text-surface-on-variant/80">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary-500" />
            SEO: {analysis.seo_score}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-secondary-500" />
            GEO: {analysis.geo_score}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-tertiary-500" />
            {analysis.recommendations_count} recs
          </span>
          <span className="ml-auto flex items-center gap-1 opacity-70">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {formatDate(analysis.created_at)}
          </span>
        </div>
      </div>

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-surface-on-variant opacity-0 transition-all group-hover:opacity-100 group-hover:bg-primary-500 group-hover:text-white shadow-sm">
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  );
}
