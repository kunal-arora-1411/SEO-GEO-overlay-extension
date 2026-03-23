"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api, type Analysis } from "@/lib/api";
import ScoreGauge from "@/components/ScoreGauge";
import AnalysisCard from "@/components/AnalysisCard";
import TrendChart from "@/components/TrendChart";
import DemoBanner from "@/components/DemoBanner";

// Demo data for when the API is not available
const demoAnalyses: Analysis[] = [
  {
    id: "1",
    url: "https://example.com/blog/ai-search-optimization",
    keyword: "AI search optimization",
    seo_score: 82,
    geo_score: 68,
    overall_score: 75,
    status: "completed",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    recommendations_count: 12,
  },
  {
    id: "2",
    url: "https://example.com/guides/seo-best-practices-2025",
    keyword: "SEO best practices",
    seo_score: 91,
    geo_score: 55,
    overall_score: 73,
    status: "completed",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    recommendations_count: 8,
  },
  {
    id: "3",
    url: "https://example.com/articles/content-marketing-strategy",
    keyword: "content marketing strategy",
    seo_score: 76,
    geo_score: 71,
    overall_score: 74,
    status: "completed",
    created_at: new Date(Date.now() - 259200000).toISOString(),
    recommendations_count: 15,
  },
  {
    id: "4",
    url: "https://example.com/blog/structured-data-guide",
    keyword: "structured data SEO",
    seo_score: 88,
    geo_score: 79,
    overall_score: 84,
    status: "processing",
    created_at: new Date().toISOString(),
    recommendations_count: 0,
  },
];

export default function DashboardHomePage() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    async function fetchAnalyses() {
      try {
        const result = await api.getAnalyses(1, 20);
        setAnalyses(result.items);
        setIsDemo(false);
      } catch {
        setAnalyses(demoAnalyses);
        setIsDemo(true);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAnalyses();
  }, []);

  const completed = analyses.filter((a) => a.status === "completed");
  const avgSeo = completed.length
    ? Math.round(completed.reduce((sum, a) => sum + a.seo_score, 0) / completed.length)
    : 0;
  const avgGeo = completed.length
    ? Math.round(completed.reduce((sum, a) => sum + a.geo_score, 0) / completed.length)
    : 0;
  const avgOverall = completed.length
    ? Math.round(completed.reduce((sum, a) => sum + a.overall_score, 0) / completed.length)
    : 0;

  // Trend data: sort by date ascending, take last 12 scores
  const sorted = [...analyses]
    .filter((a) => a.status === "completed")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const seoTrend = sorted.map((a) => a.seo_score);
  const geoTrend = sorted.map((a) => a.geo_score);

  // Count analyses created in the last 7 days
  const oneWeekAgo = Date.now() - 7 * 86400000;
  const thisWeekCount = analyses.filter(
    (a) => new Date(a.created_at).getTime() > oneWeekAgo
  ).length;

  return (
    <div className="space-y-8">
      {isDemo && <DemoBanner />}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {user?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Here&apos;s an overview of your SEO & GEO performance
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm font-medium text-slate-500">Total Analyses</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {analyses.length}
          </p>
          {thisWeekCount > 0 ? (
            <p className="mt-1 text-xs text-green-600">+{thisWeekCount} this week</p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">No activity this week</p>
          )}
        </div>

        <div className="card">
          <p className="text-sm font-medium text-slate-500">Avg. SEO Score</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-900">{avgSeo || "—"}</span>
            {seoTrend.length >= 2 && (
              <TrendChart data={seoTrend} width={80} height={32} color="#3b82f6" />
            )}
          </div>
        </div>

        <div className="card">
          <p className="text-sm font-medium text-slate-500">Avg. GEO Score</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-900">{avgGeo || "—"}</span>
            {geoTrend.length >= 2 && (
              <TrendChart data={geoTrend} width={80} height={32} color="#7c3aed" />
            )}
          </div>
        </div>

        <div className="card">
          <p className="text-sm font-medium text-slate-500">
            Analyses Remaining
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {user?.analyses_remaining ?? 5}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {user?.tier || "Free"} plan
          </p>
        </div>
      </div>

      {/* Score overview — only show when there is data */}
      {completed.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900">
            Score Overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Average scores across your {completed.length} completed {completed.length === 1 ? "analysis" : "analyses"}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            <ScoreGauge score={avgSeo} size={110} label="SEO Score" />
            <ScoreGauge
              score={avgOverall}
              size={140}
              strokeWidth={10}
              label="Overall Score"
            />
            <ScoreGauge score={avgGeo} size={110} label="GEO Score" />
          </div>
        </div>
      )}

      {/* Recent analyses */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Analyses
          </h2>
          <a
            href="/dashboard/history"
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            View all
          </a>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex items-center gap-6">
                  <div className="h-[72px] w-[72px] rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-2/3 rounded bg-slate-200" />
                    <div className="h-3 w-1/3 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-12 text-center">
            <svg className="h-10 w-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-900">No analyses yet</p>
            <p className="mt-1 text-sm text-slate-500">Run your first analysis to see results here.</p>
            <a href="/dashboard/history" className="btn-primary mt-4 text-sm">Start First Analysis</a>
          </div>
        ) : (
          <div className="space-y-4">
            {analyses.slice(0, 5).map((analysis) => (
              <AnalysisCard key={analysis.id} analysis={analysis} />
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="card bg-gradient-to-r from-primary-600 to-primary-700">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Run a New Analysis
            </h3>
            <p className="mt-1 text-sm text-primary-100">
              Enter any URL and keyword to get instant SEO & GEO scores
            </p>
          </div>
          <a
            href="/dashboard/history"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 shadow-sm transition-all hover:bg-primary-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Analysis
          </a>
        </div>
      </div>
    </div>
  );
}
