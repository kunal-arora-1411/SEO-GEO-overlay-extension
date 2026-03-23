"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, type Audit } from "@/lib/api";
import DemoBanner from "@/components/DemoBanner";

const demoAudits: Audit[] = [
  {
    id: "1",
    domain: "example.com",
    status: "completed",
    pages_crawled: 142,
    issues_found: 23,
    score: 78,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "2",
    domain: "mysite.io",
    status: "completed",
    pages_crawled: 67,
    issues_found: 8,
    score: 91,
    created_at: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: "3",
    domain: "blog.example.com",
    status: "running",
    pages_crawled: 34,
    issues_found: 5,
    score: 0,
    created_at: new Date().toISOString(),
  },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusStyles(status: Audit["status"]) {
  const styles: Record<Audit["status"], { badge: string; label: string }> = {
    completed: {
      badge: "bg-green-50 text-green-700 border-green-200",
      label: "Completed",
    },
    running: {
      badge: "bg-blue-50 text-blue-700 border-blue-200",
      label: "Running",
    },
    pending: {
      badge: "bg-yellow-50 text-yellow-700 border-yellow-200",
      label: "Pending",
    },
    failed: {
      badge: "bg-red-50 text-red-700 border-red-200",
      label: "Failed",
    },
  };
  return styles[status];
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

const STORAGE_KEY = "seo_geo_audit_ids";

function loadStoredIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAuditId(id: string) {
  const ids = loadStoredIds();
  if (!ids.includes(id)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([id, ...ids]));
  }
}

function removeAuditId(id: string) {
  const ids = loadStoredIds().filter((i) => i !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export default function AuditsPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Load audits from stored IDs on mount
  useEffect(() => {
    async function loadAudits() {
      const ids = loadStoredIds();
      if (ids.length === 0) {
        setIsLoading(false);
        return;
      }

      const results = await Promise.allSettled(
        ids.map((id) => api.getAuditStatus(id))
      );

      const loaded: Audit[] = [];
      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          loaded.push({
            id: ids[i],
            domain: "",
            status: "pending",
            pages_crawled: 0,
            issues_found: 0,
            score: 0,
            created_at: new Date().toISOString(),
            ...result.value,
          } as Audit);
        } else {
          // 404 or server gone — remove stale ID
          removeAuditId(ids[i]);
        }
      });

      if (loaded.length > 0) {
        setAudits(loaded);
        // Fetch results for completed audits to populate score/issues
        loaded
          .filter((a) => a.status === "completed")
          .forEach(async (a) => {
            try {
              const res = await api.getAuditResults(a.id);
              setAudits((prev) =>
                prev.map((x) =>
                  x.id === a.id
                    ? { ...x, score: res.avg_seo_score ?? 0, issues_found: res.common_issues.length, domain: res.domain || x.domain }
                    : x
                )
              );
            } catch { /* ignore */ }
          });
      }
      setIsLoading(false);
    }
    loadAudits();
  }, []);

  // Poll running/pending audits every 3 seconds
  useEffect(() => {
    const hasActive = audits.some(
      (a) => a.status === "running" || a.status === "pending"
    );
    if (!hasActive) return;

    const interval = setInterval(async () => {
      const active = audits.filter(
        (a) => a.status === "running" || a.status === "pending"
      );
      await Promise.all(
        active.map(async (audit) => {
          try {
            const status = await api.getAuditStatus(audit.id);
            setAudits((prev) =>
              prev.map((a) => (a.id === audit.id ? { ...a, ...status } : a))
            );
            // Fetch results once completed
            if (status.status === "completed") {
              const res = await api.getAuditResults(audit.id);
              setAudits((prev) =>
                prev.map((a) =>
                  a.id === audit.id
                    ? { ...a, score: res.avg_seo_score ?? 0, issues_found: res.common_issues.length, domain: res.domain || a.domain }
                    : a
                )
              );
            }
          } catch { /* ignore */ }
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [audits]);

  const handleStartAudit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const audit = await api.startAudit(newDomain);
      saveAuditId(audit.id);
      setAudits((prev) => {
        const base = isDemo ? [] : prev;
        return [audit, ...base];
      });
      setIsDemo(false);
      setNewDomain("");
      setShowNewForm(false);
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setFormError(
        apiError.detail || "Failed to start audit. Please try again."
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
          <h1 className="text-2xl font-bold text-slate-900">Site Audits</h1>
          <p className="mt-1 text-sm text-slate-500">
            Run comprehensive SEO & GEO audits across your entire site
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
          New Audit
        </button>
      </div>

      {/* New audit form */}
      {showNewForm && (
        <div className="card border-primary-200 bg-primary-50/50">
          <h3 className="text-sm font-semibold text-slate-900">
            Start a New Site Audit
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Enter a domain to crawl and audit all discoverable pages.
          </p>
          {formError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <form
            onSubmit={handleStartAudit}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              placeholder="example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              required
              className="input-field flex-1"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary whitespace-nowrap"
            >
              {isSubmitting ? "Starting..." : "Start Audit"}
            </button>
          </form>
        </div>
      )}

      {/* Audit cards */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-5 w-32 rounded bg-slate-200" />
              <div className="mt-4 space-y-3">
                <div className="h-4 w-full rounded bg-slate-200" />
                <div className="h-4 w-2/3 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      ) : isDemo ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {demoAudits.map((audit) => {
            const statusInfo = getStatusStyles(audit.status);
            return (
              <div key={audit.id} className="card opacity-60">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{audit.domain}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDate(audit.created_at)}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusInfo.badge}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-500">Pages</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{audit.pages_crawled}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Issues</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{audit.issues_found}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Score</p>
                    <p className={`mt-1 text-lg font-bold ${getScoreColor(audit.score)}`}>{audit.score}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : audits.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <svg
            className="h-12 w-12 text-slate-300"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            No audits yet
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Start your first site audit to get comprehensive insights.
          </p>
          <button
            onClick={() => setShowNewForm(true)}
            className="btn-primary mt-4"
          >
            Start First Audit
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {audits.map((audit) => {
            const statusInfo = getStatusStyles(audit.status);
            return (
              <div key={audit.id} className="card transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {audit.domain}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDate(audit.created_at)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusInfo.badge}`}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-500">Pages</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {audit.pages_crawled}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Issues</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {audit.issues_found}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Score</p>
                    <p
                      className={`mt-1 text-lg font-bold ${
                        audit.status === "completed"
                          ? getScoreColor(audit.score)
                          : "text-slate-400"
                      }`}
                    >
                      {audit.status === "completed" ? audit.score : "--"}
                    </p>
                  </div>
                </div>

                {(audit.status === "running" || audit.status === "pending") && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-slate-500">Crawling in progress...</p>
                      <p className="text-xs font-medium text-primary-600">
                        {audit.progress_pct ?? 0}%
                      </p>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-primary-500 transition-all duration-500"
                        style={{ width: `${audit.progress_pct ?? 0}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {audit.pages_crawled} of {audit.total_pages ?? "?"} pages crawled
                    </p>
                  </div>
                )}

                {audit.status === "completed" && (
                  <button className="mt-4 w-full btn-ghost text-primary-600 hover:text-primary-700">
                    View Full Report
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
