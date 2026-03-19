"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { api, type Team, type TeamMember } from "@/lib/api";

const demoTeam: Team = {
  id: "1",
  name: "My Team",
  plan: "Pro",
  members: [
    {
      id: "1",
      email: "owner@example.com",
      full_name: "Team Owner",
      role: "owner",
      joined_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    },
    {
      id: "2",
      email: "member@example.com",
      full_name: "Team Member",
      role: "member",
      joined_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
  ],
};

export default function TeamsPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team>(demoTeam);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    async function fetchTeam() {
      try {
        const result = await api.getTeam();
        setTeam(result);
      } catch {
        // Use demo data
      }
    }
    fetchTeam();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      await api.inviteTeamMember(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      // Refresh team data
      const result = await api.getTeam();
      setTeam(result);
    } catch {
      // Silently fail for demo
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await api.removeTeamMember(userId);
      setTeam((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m.id !== userId),
      }));
    } catch {
      // Silently fail
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

      {/* Invite member */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Invite Member</h2>
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
          Members ({team.members.length})
        </h2>
        <div className="divide-y divide-slate-100">
          {team.members.map((member) => (
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
