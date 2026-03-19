"use client";

import { useEffect, useState } from "react";
import { api, type Competitor } from "@/lib/api";

const demoCompetitors: Competitor[] = [
  {
    id: "1",
    domain: "competitor-a.com",
    last_score: 78,
    trend: [65, 68, 72, 74, 78],
    tracked_since: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: "2",
    domain: "competitor-b.com",
    last_score: 85,
    trend: [80, 82, 83, 84, 85],
    tracked_since: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
];

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>(demoCompetitors);
  const [newDomain, setNewDomain] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    async function fetchCompetitors() {
      try {
        const result = await api.getCompetitors();
        if (result.length > 0) setCompetitors(result);
      } catch {
        // Use demo data
      }
    }
    fetchCompetitors();
  }, []);

  const handleAdd = async () => {
    if (!newDomain.trim()) return;
    setIsAdding(true);
    try {
      const competitor = await api.addCompetitor(newDomain.trim());
      setCompetitors((prev) => [...prev, competitor]);
      setNewDomain("");
    } catch {
      // Silently fail for demo
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await api.removeCompetitor(id);
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // Silently fail
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Competitors</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track and compare your SEO & GEO performance against competitors
        </p>
      </div>

      {/* Add competitor */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Add Competitor</h2>
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="competitor-domain.com"
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
      <div className="space-y-4">
        {competitors.map((competitor) => (
          <div key={competitor.id} className="card flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                {competitor.domain.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-slate-900">{competitor.domain}</p>
                <p className="text-xs text-slate-500">
                  Tracked since {new Date(competitor.tracked_since).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">
                  {competitor.last_score}
                </p>
                <p className="text-xs text-slate-500">Latest Score</p>
              </div>
              <button
                onClick={() => handleRemove(competitor.id)}
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                aria-label="Remove competitor"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {competitors.length === 0 && (
          <div className="card text-center">
            <p className="text-slate-500">No competitors tracked yet. Add one above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
