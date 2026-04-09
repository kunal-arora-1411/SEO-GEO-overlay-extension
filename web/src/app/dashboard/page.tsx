"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api, type Analysis } from "@/lib/api";
import ScoreGauge from "@/components/ScoreGauge";
import AnalysisCard from "@/components/AnalysisCard";
import TrendChart from "@/components/TrendChart";

export default function DashboardHomePage() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalyses() {
      try {
        const result = await api.getAnalyses(1, 5);
        setAnalyses(result.items);
      } catch {
        // leave as empty array — empty state shown below
      } finally {
        setIsLoading(false);
      }
    }
    fetchAnalyses();
  }, []);

  const count = analyses.length;
  const avgSeo = count > 0 ? Math.round(analyses.reduce((sum, a) => sum + a.seo_score, 0) / count) : 0;
  const avgGeo = count > 0 ? Math.round(analyses.reduce((sum, a) => sum + a.geo_score, 0) / count) : 0;
  const avgOverall = count > 0 ? Math.round(analyses.reduce((sum, a) => sum + a.overall_score, 0) / count) : 0;
  const trendData = analyses.map((a) => a.seo_score).reverse();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-[2rem] font-extrabold tracking-tight text-surface-on sm:text-[2.5rem]">
          Welcome back, {user?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-2 text-base text-surface-on-variant">
          Here is an overview of your SEO and GEO performance this month.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card group relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary-100">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary-500/5 blur-2xl transition-all group-hover:bg-primary-500/10" />
          <p className="text-sm font-bold text-surface-on-variant">Total Analyses</p>
          <div className="mt-4 flex flex-col">
            <span className="font-display text-4xl font-extrabold tracking-tight text-surface-on">
              {analyses.length}
            </span>
            <span className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary-600">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
              All time
            </span>
          </div>
        </div>

        <div className="card group relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-tertiary-100">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-tertiary-500/5 blur-2xl transition-all group-hover:bg-tertiary-500/10" />
          <p className="text-sm font-bold text-surface-on-variant">Avg. SEO Score</p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <span className="font-display text-4xl font-extrabold tracking-tight text-surface-on">{avgSeo}</span>
            <TrendChart
              data={trendData.length > 1 ? trendData : [0]}
              width={90}
              height={36}
              color="#006c63"
            />
          </div>
        </div>

        <div className="card group relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-secondary-100">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-secondary-500/5 blur-2xl transition-all group-hover:bg-secondary-500/10" />
          <p className="text-sm font-bold text-surface-on-variant">Avg. GEO Score</p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <span className="font-display text-4xl font-extrabold tracking-tight text-surface-on">{avgGeo}</span>
            <TrendChart
              data={[45, 48, 52, 50, 55, 58, 62, 60, 65, 68, 70, avgGeo]}
              width={90}
              height={36}
              color="#712ae2"
            />
          </div>
        </div>

        <div className="card group relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary-100">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary-500/5 blur-2xl transition-all group-hover:bg-primary-500/10" />
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-surface-on-variant">Analyses Remaining</p>
            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold text-surface-on-variant">
              {user?.tier || "Free"}
            </span>
          </div>
          <div className="mt-4">
            <p className="font-display text-4xl font-extrabold tracking-tight text-surface-on">
              {user?.analyses_remaining ?? 5}
            </p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-secondary-500 to-primary-500 transition-all duration-1000" 
                style={{ width: `${Math.min(100, ((user?.analyses_remaining ?? 5) / 5) * 100)}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Score overview */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-surface-container-low pb-6">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-surface-on">
              Score Overview
            </h2>
            <p className="mt-1 text-sm text-surface-on-variant">
              Average scores across all your analyses
            </p>
          </div>
        </div>
        <div className="mt-10 mb-6 flex flex-wrap items-center justify-center gap-12 sm:gap-24">
          <ScoreGauge score={avgSeo} size={150} strokeWidth={4} label="SEO Score" />
          <ScoreGauge
            score={avgOverall}
            size={180}
            strokeWidth={10}
            label="Overall Score"
          />
          <ScoreGauge score={avgGeo} size={150} strokeWidth={4} label="GEO Score" />
        </div>
      </div>

      {/* Recent analyses */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight text-surface-on">
            Recent Analyses
          </h2>
          <a
            href="/dashboard/history"
            className="flex items-center gap-1 text-sm font-bold text-primary-600 transition-colors hover:text-primary-500"
          >
            View all history
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="card animate-pulse"
              >
                <div className="flex items-center gap-6">
                  <div className="h-[72px] w-[72px] rounded-full bg-surface-container-high" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-2/3 rounded bg-surface-container-high" />
                    <div className="h-3 w-1/3 rounded bg-surface-container-high" />
                    <div className="h-3 w-1/2 rounded bg-surface-container-high" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <div className="card flex flex-col items-center py-16 text-center border border-dashed border-surface-container-high">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-surface-on-variant/50 mb-4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-surface-on-variant font-medium">No analyses run yet.</p>
            <p className="text-sm text-surface-on-variant/70 mt-1">Get started by running your first SEO & GEO audit.</p>
            <a
              href="/dashboard/history"
              className="btn-primary mt-6"
            >
              Run First Analysis
            </a>
          </div>
        ) : (
          <div className="space-y-4 bg-surface-container-low/50 p-2 border border-surface-container-high rounded-3xl">
            {analyses.slice(0, 5).map((analysis) => (
              <AnalysisCard key={analysis.id} analysis={analysis} />
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 to-secondary-600 p-8 sm:p-10 shadow-xl shadow-primary-500/10">
        <div className="absolute right-0 top-0 h-96 w-96 translate-x-1/3 -translate-y-1/3 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-xl">
            <h3 className="font-display text-2xl font-bold tracking-tight text-white mb-2">
              Ready to improve your visibility?
            </h3>
            <p className="text-base text-primary-100 font-medium">
              Enter any URL and keyword to get instant SEO & GEO scores and actionable recommendations.
            </p>
          </div>
          <a
            href="/dashboard/history"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-primary-700 shadow-lg shadow-black/5 transition-all hover:bg-surface-container-low hover:text-primary-800 hover:scale-105 active:scale-95"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Run New Analysis
          </a>
        </div>
      </div>
    </div>
  );
}
