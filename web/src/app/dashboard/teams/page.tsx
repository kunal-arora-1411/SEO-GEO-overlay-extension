"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api, type Team, type TeamMember } from "@/lib/api";
import DemoBanner from "@/components/DemoBanner";

const demoMembers: TeamMember[] = [
  { id: "1", user_id: "1", email: "owner@example.com", display_name: "Team Owner", role: "owner", joined_at: new Date(Date.now() - 60 * 86400000).toISOString() },
  { id: "2", user_id: "2", email: "member@example.com", display_name: "Team Member", role: "member", joined_at: new Date(Date.now() - 14 * 86400000).toISOString() },
];

const roleColors: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700",
  admin: "bg-blue-100 text-blue-700",
  member: "bg-slate-100 text-slate-700",
  viewer: "bg-slate-100 text-slate-500",
};

function getInitials(name: string | null, email: string): string {
  if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return email.charAt(0).toUpperCase();
}

export default function TeamsPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    async function fetchTeam() {
      try {
        const teams = await api.getTeams();
        if (teams.length > 0) {
          setTeam(teams[0]);
          const memberList = await api.getTeamMembers(teams[0].id);
          setMembers(memberList);
        }
        // teams.length === 0 means no team yet — show create UI (not demo)
      } catch {
        // API down — show demo data
        setTeam({ id: "demo", name: "My Team", created_at: new Date().toISOString(), member_count: 2 });
        setMembers(demoMembers);
        setIsDemo(true);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTeam();
  }, []);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return;
    setIsCreating(true);
    try {
      const newTeam = await api.createTeam(teamName.trim());
      setTeam(newTeam);
      setMembers([]);
      setTeamName("");
    } catch { /* ignore */ } finally {
      setIsCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !team || isDemo) return;
    setInviteError("");
    setIsInviting(true);
    try {
      const newMember = await api.inviteTeamMember(team.id, inviteEmail.trim(), inviteRole);
      setMembers((prev) => [...prev, newMember]);
      setInviteEmail("");
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setInviteError(apiError.detail || "Failed to invite member.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (memberId: string, userId: string) => {
    if (!team || isDemo) return;
    try {
      await api.removeTeamMember(team.id, userId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch { /* ignore */ }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 w-24 rounded-lg bg-slate-200" />
        <div className="card space-y-4">
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="h-10 w-full rounded-lg bg-slate-200" />
        </div>
        <div className="card space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-12 w-full rounded-lg bg-slate-200" />)}
        </div>
      </div>
    );
  }

  // No team yet — show create team UI
  if (!team && !isDemo) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="mt-1 text-sm text-slate-500">Collaborate with your team on SEO & GEO analysis</p>
        </div>
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <svg className="h-10 w-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          <p className="mt-3 text-sm font-medium text-slate-900">No team yet</p>
          <p className="mt-1 text-sm text-slate-500">Create a team to start collaborating.</p>
          <div className="mt-6 flex gap-3">
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Team name"
              className="input-field w-56"
              onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
            />
            <button onClick={handleCreateTeam} disabled={isCreating} className="btn-primary">
              {isCreating ? "Creating..." : "Create Team"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {isDemo && <DemoBanner />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{team?.name ?? "Team"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user?.tier ? <span className="capitalize">{user.tier} plan</span> : null}
            {" · "}Manage your team members and their roles
          </p>
        </div>
      </div>

      {/* Invite member */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Invite Member</h2>
        {inviteError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{inviteError}</div>
        )}
        <div className="mt-4 flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            disabled={isDemo}
            className="input-field flex-1 disabled:opacity-50"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            disabled={isDemo}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-50"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
          <button onClick={handleInvite} disabled={isInviting || isDemo} className="btn-primary px-6 py-2.5 disabled:opacity-50">
            {isInviting ? "Inviting..." : "Invite"}
          </button>
        </div>
      </div>

      {/* Members list */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Members ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-slate-500">No members yet. Invite someone above.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
                    {getInitials(member.display_name, member.email)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{member.display_name || member.email}</p>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[member.role] ?? roleColors.member}`}>
                    {member.role}
                  </span>
                  {member.role !== "owner" && !isDemo && (
                    <button
                      onClick={() => handleRemove(member.id, member.user_id)}
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
        )}
      </div>
    </div>
  );
}
