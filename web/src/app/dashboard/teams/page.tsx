"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api, type Team, type TeamMember } from "@/lib/api";

export default function TeamsPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTeam() {
      try {
        const result = await api.getTeam();
        setTeam(result);
      } catch {
        // leave null — empty state shown
      } finally {
        setIsLoading(false);
      }
    }
    fetchTeam();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    setInviteError(null);
    try {
      await api.inviteTeamMember(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      const result = await api.getTeam();
      setTeam(result);
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      setInviteError(detail || "Failed to invite member. Please try again.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    setRemoveError(null);
    try {
      await api.removeTeamMember(memberId);
      setTeam((prev) =>
        prev ? { ...prev, members: prev.members.filter((m) => m.id !== memberId) } : prev
      );
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      setRemoveError(detail || "Failed to remove member.");
    }
  };

  const roleColors: Record<string, string> = {
    owner: "bg-amber-100 text-amber-700",
    admin: "bg-blue-100 text-blue-700",
    member: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your team members and their roles
        </p>
      </div>

      {removeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {removeError}
        </div>
      )}

      {/* Invite member */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Invite Member</h2>
        {inviteError && (
          <p className="mt-2 text-sm text-red-600">{inviteError}</p>
        )}
        <div className="mt-4 flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={isInviting}
            className="btn-primary px-6 py-2.5"
          >
            {isInviting ? "Inviting..." : "Invite"}
          </button>
        </div>
      </div>

      {/* Members list */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Members ({team?.members.length ?? 0})
        </h2>
        {isLoading && (
          <div className="animate-pulse space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 py-4">
                <div className="h-10 w-10 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-3 w-24 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="divide-y divide-slate-100">
          {(team?.members ?? []).map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                  {member.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{member.full_name}</p>
                  <p className="text-xs text-slate-500">{member.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    roleColors[member.role] || roleColors.member
                  }`}
                >
                  {member.role}
                </span>
                {member.role !== "owner" && (
                  <button
                    onClick={() => handleRemove(member.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Remove member"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
