"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      await api.updateSettings({
        full_name: fullName,
        notifications_enabled: notificationsEnabled,
        weekly_reports: weeklyReports,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Silently fail for demo
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Plan</h2>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">
              {user?.tier || "Free"} Plan
            </p>
            <p className="text-sm text-slate-500">
              {user?.analyses_remaining ?? 5} analyses remaining this month
            </p>
          </div>
          <a
            href="/#pricing"
            className="btn-primary px-5 py-2"
          >
            Upgrade
          </a>
        </div>
      </div>

      {/* Notifications */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
        <div className="mt-4 space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Email Notifications</p>
              <p className="text-sm text-slate-500">
                Get notified when analyses complete
              </p>
            </div>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                notificationsEnabled ? "bg-primary-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  notificationsEnabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </label>
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Weekly Reports</p>
              <p className="text-sm text-slate-500">
                Receive a weekly summary of your performance
              </p>
            </div>
            <button
              onClick={() => setWeeklyReports(!weeklyReports)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                weeklyReports ? "bg-primary-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  weeklyReports ? "translate-x-5" : ""
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary px-6 py-2.5"
        >
          {isSaving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
        <button
          onClick={logout}
          className="rounded-lg border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
