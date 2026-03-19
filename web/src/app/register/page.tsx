"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsSubmitting(true);

    try {
      await register(email, password, fullName);
      router.push("/dashboard");
    } catch (err: unknown) {
      const apiError = err as { detail?: string };
      setError(apiError.detail || "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden w-1/2 bg-slate-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <span className="text-lg font-bold text-white">
            SEO<span className="text-primary-400">&</span>GEO
          </span>
        </Link>

        <div>
          <h2 className="text-3xl font-bold text-white">
            Start optimizing for the AI era
          </h2>
          <p className="mt-4 text-slate-300">
            Join 12,000+ content creators and SEO professionals already using
            SEO & GEO Optimizer.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "5 free analyses every month",
              "No credit card required",
              "Full SEO & GEO scoring",
              "Chrome extension included",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-slate-300">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-primary-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-slate-500">
          &copy; {new Date().getFullYear()} SEO & GEO Optimizer
        </p>
      </div>

      {/* Right panel - Registration form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <span className="text-lg font-bold text-slate-900">
                SEO<span className="text-primary-600">&</span>GEO
              </span>
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Get started with your free account today
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-slate-700"
              >
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field mt-1.5"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field mt-1.5"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field mt-1.5"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-700"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field mt-1.5"
                placeholder="Repeat your password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-2.5"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Creating account...
                </span>
              ) : (
                "Create account"
              )}
            </button>

            <p className="text-center text-xs text-slate-500">
              By creating an account, you agree to our{" "}
              <a href="#" className="text-primary-600 hover:text-primary-500">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-primary-600 hover:text-primary-500">
                Privacy Policy
              </a>
              .
            </p>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary-600 hover:text-primary-500"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
