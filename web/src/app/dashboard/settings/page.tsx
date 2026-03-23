"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { api, type BillingInfo } from "@/lib/api";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [fullName, setFullName] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [weeklyReports, setWeeklyReports] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [billing, setBilling] = useState<BillingInfo | null>(null);

  useEffect(() => {
    async function loadAll() {
      const [settingsResult, billingResult] = await Promise.allSettled([
        api.getSettings(),
        api.getBillingInfo(),
      ]);

      if (settingsResult.status === "fulfilled") {
        setFullName(settingsResult.value.full_name ?? "");
        setNotificationsEnabled(settingsResult.value.notifications_enabled);
        setWeeklyReports(settingsResult.value.weekly_reports);
      } else {
        setFullName(user?.full_name ?? "");
      }

      if (billingResult.status === "fulfilled") {
        setBilling(billingResult.value);
      }

      setIsLoading(false);
    }
    loadAll();
  }, [user?.full_name]);

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
      // Silently fail
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 w-32 rounded-lg bg-slate-200" />
        <div className="card space-y-4">
          <div className="h-5 w-24 rounded bg-slate-200" />
          <div className="h-10 w-full rounded-lg bg-slate-200" />
          <div className="h-10 w-full rounded-lg bg-slate-200" />
        </div>
        <div className="card">
          <div className="h-5 w-16 rounded bg-slate-200" />
          <div className="mt-4 h-10 w-full rounded-lg bg-slate-200" />
        </div>
      </div>
    );
  }

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
            <div className="flex items-center gap-2">
              <p className="font-medium text-slate-900 capitalize">
                {billing?.tier || user?.tier || "Free"} Plan
              </p>
              {billing?.subscription_status === "active" && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>
              )}
              {billing?.subscription_status === "canceled" && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Canceled</span>
              )}
            </div>
            {billing ? (
              <p className="mt-1 text-sm text-slate-500">
                {billing.scans_today} / {billing.scans_limit} scans used today
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                {user?.analyses_remaining ?? 5} analyses remaining today
              </p>
            )}
            {billing && (
              <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-primary-500"
                  style={{ width: `${Math.min(100, (billing.scans_today / billing.scans_limit) * 100)}%` }}
                />
              </div>
            )}
          </div>
          {(!billing || billing.tier === "free" || billing.subscription_status === "canceled") && (
            <a href="/pricing" className="btn-primary px-5 py-2">
              Upgrade
            </a>
          )}
          {billing && billing.tier !== "free" && billing.subscription_status === "active" && (
            <span className="text-sm text-slate-500">Manage via billing portal</span>
          )}
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
