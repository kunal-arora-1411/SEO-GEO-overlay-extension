"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollReveal, { StaggerContainer, StaggerItem } from "@/components/ScrollReveal";
import MagneticButton from "@/components/MagneticButton";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

const pricingPlans = [
  {
    name: "Free",
    monthlyPrice: 0,
    description: "Get started, no credit card needed.",
    features: [
      "5 analyses per day",
      "SEO & GEO scoring",
      "Chrome extension",
      "Basic recommendations",
    ],
    cta: "Get started free",
    highlight: false,
  },
  {
    name: "Starter",
    monthlyPrice: 29,
    description: "For individual creators and bloggers.",
    features: [
      "50 analyses per day",
      "SEO & GEO scoring",
      "AI content suggestions",
      "Schema generation",
      "PDF exports",
    ],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Pro",
    monthlyPrice: 79,
    description: "For professionals and small teams.",
    features: [
      "Unlimited analyses",
      "Full site audits",
      "Competitor tracking",
      "AI rewriting engine",
      "API access",
      "3 team seats",
    ],
    cta: "Start free trial",
    highlight: true,
  },
  {
    name: "Agency",
    monthlyPrice: 199,
    description: "For agencies and enterprises.",
    features: [
      "Unlimited everything",
      "White-label reports",
      "Custom integrations",
      "Dedicated support",
      "10 team seats",
      "SSO & audit logs",
    ],
    cta: "Contact sales",
    highlight: false,
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-ai-gradient relative overflow-hidden">
      {/* Subtle background overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30 bg-white/40" />
      <Navbar />

      <main className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <ScrollReveal className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-[2.8rem] md:text-[3.5rem] font-medium tracking-[-0.02em] leading-tight text-slate-900 mb-4">
            Pricing
          </h1>
          <p className="text-lg text-slate-500 mb-10">
            Start free. Scale as you grow.
          </p>
          
          <div className="inline-flex items-center p-1 rounded-full bg-slate-100">
            <button 
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${!annual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${annual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Annual <span className="text-primary-500 text-xs font-medium ml-1">-20%</span>
            </button>
          </div>
        </ScrollReveal>

        <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch" staggerDelay={0.1}>
          {pricingPlans.map((plan) => {
            const displayPrice = plan.monthlyPrice === 0
              ? "$0"
              : annual
                ? `$${Math.floor(plan.monthlyPrice * 0.8)}`
                : `$${plan.monthlyPrice}`;

            return (
              <StaggerItem key={plan.name}>
                <motion.div
                  className={`relative flex flex-col p-7 rounded-2xl h-full transition-all duration-300
                    ${plan.highlight
                      ? 'bg-white border-2 border-slate-900 shadow-sm'
                      : 'bg-white border border-slate-200'
                    }
                  `}
                  whileHover={{ y: -4, transition: { duration: 0.25 } }}
                >
                  {plan.highlight && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-slate-900 text-white text-[10px] font-medium rounded-full tracking-wide uppercase">
                      Popular
                    </div>
                  )}

                  <h3 className="text-lg font-medium text-slate-900 mb-1">{plan.name}</h3>
                  <p className="text-slate-400 text-xs mb-5">{plan.description}</p>

                  <div className="mb-1">
                    <span className="text-4xl font-medium text-slate-900 tracking-tight">
                      {displayPrice}
                    </span>
                    <span className="text-slate-400 text-sm ml-1">
                      {plan.monthlyPrice === 0 ? "forever" : "/mo"}
                    </span>
                  </div>
                  {annual && plan.monthlyPrice > 0 && (
                    <p className="mb-5 text-xs text-slate-400">billed ${Math.floor(plan.monthlyPrice * 0.8 * 12)}/yr</p>
                  )}
                  {(!annual || plan.monthlyPrice === 0) && <div className="mb-5" />}

                  <ul className="space-y-3 mb-8 flex-grow">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center text-slate-600 text-sm">
                        <svg className="h-4 w-4 flex-shrink-0 text-primary-500 mr-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <MagneticButton className="w-full mt-auto">
                    <Link
                      href="/register"
                      className={`w-full text-center py-3 rounded-xl font-medium transition-all text-sm
                        ${plan.highlight ? 'btn-primary' : 'btn-secondary'}
                      `}
                    >
                      {plan.cta}
                    </Link>
                  </MagneticButton>
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </main>

      <Footer />
    </div>
  );
}
