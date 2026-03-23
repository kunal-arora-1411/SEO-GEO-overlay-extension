"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { motion, useScroll, useTransform } from "framer-motion";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, logout } = useAuth();
  const { scrollY } = useScroll();
  
  // Transform scroll position to blur, shadow and background opacity
  const blur = useTransform(scrollY, [0, 50], ["blur(0px)", "blur(12px)"]);
  const background = useTransform(scrollY, [0, 50], ["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.85)"]);
  const borderDisplay = useTransform(scrollY, [0, 50], ["transparent", "rgba(226, 232, 240, 0.8)"]);

  return (
    <motion.nav 
      className="fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300"
      style={{
        backdropFilter: blur,
        WebkitBackdropFilter: blur,
        backgroundColor: background,
        borderColor: borderDisplay,
      }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800 tracking-tight">SEO & GEO Optimizer</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-0.5 md:flex">
            <a href="/#features" className="btn-ghost text-xs">Features</a>
            <Link href="/pricing" className="btn-ghost text-xs">Pricing</Link>
            <a href="https://docs.seo-geo-optimizer.com" className="btn-ghost text-xs" target="_blank" rel="noopener noreferrer">Docs</a>
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-2 md:flex">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard" className="btn-ghost text-xs">Dashboard</Link>
                <button onClick={logout} className="btn-secondary text-xs px-4 py-2">Log Out</button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-ghost text-xs">Sign in</Link>
                <Link href="/register" className="btn-primary text-xs px-4 py-2">Get Started</Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-100 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              <a href="/#features" className="btn-ghost justify-start text-xs" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <Link href="/pricing" className="btn-ghost justify-start text-xs" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
              <div className="border-t border-slate-100 my-2" />
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard" className="btn-ghost justify-start text-xs">Dashboard</Link>
                  <button onClick={logout} className="btn-ghost justify-start text-red-500 text-xs">Log Out</button>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-ghost justify-start text-xs">Sign in</Link>
                  <Link href="/register" className="btn-primary text-center text-xs mt-2">Get Started</Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.nav>
  );
}
