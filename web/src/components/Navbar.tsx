"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
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

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 md:flex">
            <a href="#features" className="btn-ghost">
              Features
            </a>
            <a href="#pricing" className="btn-ghost">
              Pricing
            </a>
            <a
              href="https://docs.seo-geo-optimizer.com"
              className="btn-ghost"
              target="_blank"
              rel="noopener noreferrer"
            >
              Docs
            </a>
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard" className="btn-ghost">
                  Dashboard
                </Link>
                <button onClick={logout} className="btn-secondary text-sm px-4 py-2">
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-ghost">
                  Log In
                </Link>
                <Link href="/register" className="btn-primary text-sm px-4 py-2">
                  Get Started Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 py-4 md:hidden">
            <div className="flex flex-col gap-2">
              <a href="#features" className="btn-ghost justify-start" onClick={() => setMobileMenuOpen(false)}>
                Features
              </a>
              <a href="#pricing" className="btn-ghost justify-start" onClick={() => setMobileMenuOpen(false)}>
                Pricing
              </a>
              <div className="border-t border-slate-200 my-2" />
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard" className="btn-ghost justify-start">
                    Dashboard
                  </Link>
                  <button onClick={logout} className="btn-ghost justify-start text-red-600">
                    Log Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-ghost justify-start">
                    Log In
                  </Link>
                  <Link href="/register" className="btn-primary text-center">
                    Get Started Free
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
