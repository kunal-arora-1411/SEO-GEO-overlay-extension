"use client";

import { useEffect, useState } from "react";
import { api, type Competitor } from "@/lib/api";
import DemoBanner from "@/components/DemoBanner";

const demoCompetitors: Competitor[] = [
  {
    id: "1",
    url: "https://competitor-a.com",
    domain: "competitor-a.com",
    name: "Competitor A",
    last_analyzed: new Date(Date.now() - 2 * 86400000).toISOString(),
    seo_score: 78,
    geo_score: 65,
  },
  {
    id: "2",
    url: "https://competitor-b.com",
    domain: "competitor-b.com",
    name: "Competitor B",
    last_analyzed: new Date(Date.now() - 7 * 86400000).toISOString(),
    seo_score: 85,
    geo_score: 72,
  },
];

function ScorePill({ label, value }: { label: string; value: number | null }) {
  if (value === null) return (
    <div className="text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-400">—</p>
    </div>
  );
  const color = value >= 80 ? "text-green-600" : value >= 60 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    async function fetchCompetitors() {
      try {
        const result = await api.getCompetitors();
        setCompetitors(result);
      } catch {
        setCompetitors(demoCompetitors);
        setIsDemo(true);
      } finally {
        setIsLoading(false);
      }
    }
    fetchCompetitors();
  }, []);

  const handleAdd = async () => {
    if (!newDomain.trim()) return;
    setAddError("");
    setIsAdding(true);
    try {
      const competitor = await api.addCompetitor(newDomain.trim());
      setCompetitors((prev) => {
        const base = isDemo ? [] : prev;
        return [...base, competitor];
      });
      setIsDemo(false);
      setNewDomain("");
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setAddError(apiError.detail || "Failed to add competitor. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (isDemo) return;
    try {
      await api.removeCompetitor(id);
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-8">
      {isDemo && <DemoBanner />}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Competitors</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track and compare your SEO & GEO performance against competitors
        </p>
      </div>

      {/* Add competitor */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Add Competitor</h2>
        <p className="mt-1 text-xs text-slate-500">Enter a domain or full URL to start tracking.</p>
        {addError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {addError}
          </div>
        )}
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="competitor-domain.com"
            className="input-field flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={isAdding}
            className="btn-primary px-6 py-2.5"
          >
            {isAdding ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      {/* Competitor list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card animate-pulse flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-slate-200" />
                <div className="space-y-2">
                  <div className="h-4 w-36 rounded bg-slate-200" />
                  <div className="h-3 w-24 rounded bg-slate-200" />
                </div>
              </div>
              <div className="flex gap-8">
                <div className="h-8 w-12 rounded bg-slate-200" />
                <div className="h-8 w-12 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      ) : competitors.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <svg className="h-10 w-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p className="mt-3 text-sm font-medium text-slate-900">No competitors tracked yet</p>
          <p className="mt-1 text-sm text-slate-500">Add a competitor domain above to start comparing.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {competitors.map((competitor) => (
            <div key={competitor.id} className={`card flex items-center justify-between ${isDemo ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                  {competitor.domain.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{competitor.name || competitor.domain}</p>
                  <p className="text-xs text-slate-500">
                    {competitor.last_analyzed
                      ? `Last analysed ${new Date(competitor.last_analyzed).toLocaleDateString()}`
                      : "Not yet analysed"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <ScorePill label="SEO" value={competitor.seo_score} />
                <ScorePill label="GEO" value={competitor.geo_score} />
                {!isDemo && (
                  <button
                    onClick={() => handleRemove(competitor.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Remove competitor"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
