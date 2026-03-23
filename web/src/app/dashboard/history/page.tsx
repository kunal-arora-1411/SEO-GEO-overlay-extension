"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, type Analysis } from "@/lib/api";
import ScoreGauge from "@/components/ScoreGauge";
import DemoBanner from "@/components/DemoBanner";

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
    status: "completed",
    created_at: new Date(Date.now() - 345600000).toISOString(),
    recommendations_count: 6,
  },
  {
    id: "5",
    url: "https://example.com/blog/technical-seo-checklist",
    keyword: "technical SEO checklist",
    seo_score: 94,
    geo_score: 62,
    overall_score: 78,
    status: "completed",
    created_at: new Date(Date.now() - 432000000).toISOString(),
    recommendations_count: 4,
  },
  {
    id: "6",
    url: "https://example.com/blog/link-building-strategies",
    keyword: "link building strategies",
    seo_score: 67,
    geo_score: 58,
    overall_score: 63,
    status: "completed",
    created_at: new Date(Date.now() - 518400000).toISOString(),
    recommendations_count: 18,
  },
  {
    id: "7",
    url: "https://example.com/blog/keyword-research",
    keyword: "keyword research guide",
    seo_score: 85,
    geo_score: 74,
    overall_score: 80,
    status: "completed",
    created_at: new Date(Date.now() - 604800000).toISOString(),
    recommendations_count: 9,
  },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // New analysis form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    async function fetchAnalyses() {
      try {
        const result = await api.getAnalyses(page, 10);
        setAnalyses(result.items);
        setTotalPages(result.pages);
        setIsDemo(false);
      } catch {
        setAnalyses(demoAnalyses);
        setIsDemo(true);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAnalyses();
  }, [page]);

  const handleStartAnalysis = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const analysis = await api.startAnalysis(newUrl, newKeyword);
      setAnalyses((prev) => {
        const base = isDemo ? [] : prev;
        return [analysis, ...base];
      });
      setIsDemo(false);
      setNewUrl("");
      setNewKeyword("");
      setShowNewForm(false);
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setFormError(
        apiError.detail || "Failed to start analysis. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {isDemo && <DemoBanner />}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Analysis History
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View and manage all your past analyses
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="btn-primary"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Analysis
        </button>
      </div>

      {/* New analysis form */}
      {showNewForm && (
        <div className="card border-primary-200 bg-primary-50/50">
          <h3 className="text-sm font-semibold text-slate-900">
            Start a New Analysis
          </h3>
          {formError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <form
            onSubmit={handleStartAnalysis}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="url"
              placeholder="https://example.com/page"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              required
              className="input-field flex-1"
            />
            <input
              type="text"
              placeholder="Target keyword"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              required
              className="input-field sm:w-48"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary whitespace-nowrap"
            >
              {isSubmitting ? "Starting..." : "Analyze"}
            </button>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  URL
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Keyword
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Score
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  SEO
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  GEO
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="h-4 w-48 rounded bg-slate-200" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-24 rounded bg-slate-200" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="mx-auto h-10 w-10 rounded-full bg-slate-200" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="mx-auto h-4 w-8 rounded bg-slate-200" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="mx-auto h-4 w-8 rounded bg-slate-200" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="mx-auto h-5 w-20 rounded-full bg-slate-200" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-28 rounded bg-slate-200" />
                      </td>
                    </tr>
                  ))
                : analyses.length === 0
                ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <svg
                          className="mx-auto h-10 w-10 text-slate-300"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <p className="mt-3 text-sm font-medium text-slate-900">No analyses yet</p>
                        <p className="mt-1 text-sm text-slate-500">Run your first analysis to see results here.</p>
                        <button
                          onClick={() => setShowNewForm(true)}
                          className="btn-primary mt-4"
                        >
                          Start First Analysis
                        </button>
                      </td>
                    </tr>
                  )
                : analyses.map((analysis) => (
                    <tr
                      key={analysis.id}
                      className="transition-colors hover:bg-slate-50/50"
                    >
                      <td className="px-6 py-4">
                        <div className="max-w-[200px]">
                          <p
                            className="truncate text-sm font-medium text-slate-900"
                            title={analysis.url}
                          >
                            {analysis.url}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {analysis.keyword}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <ScoreGauge
                            score={analysis.overall_score}
                            size={44}
                            strokeWidth={4}
                            animated={false}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-medium text-slate-700">
                        {analysis.seo_score}
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-medium text-slate-700">
                        {analysis.geo_score}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(analysis.status)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                        {formatDate(analysis.created_at)}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
