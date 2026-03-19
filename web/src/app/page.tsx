"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PricingCard from "@/components/PricingCard";
import ScoreGauge from "@/components/ScoreGauge";

const features = [
  {
    title: "SEO Analysis",
    description:
      "Deep analysis of on-page SEO factors including meta tags, headings, content structure, internal linking, and technical performance.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "GEO Scoring",
    description:
      "Evaluate how well your content performs for AI-powered search engines like ChatGPT, Perplexity, and Google SGE with our proprietary scoring.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    color: "bg-purple-50 text-purple-600",
  },
  {
    title: "AI Rewriting",
    description:
      "Get AI-powered content suggestions that maintain your voice while improving discoverability across both traditional and AI search engines.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    ),
    color: "bg-amber-50 text-amber-600",
  },
  {
    title: "Schema Generation",
    description:
      "Automatically generate structured data markup (JSON-LD) to help search engines and AI assistants understand your content better.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    color: "bg-green-50 text-green-600",
  },
];

const pricingPlans = [
  {
    name: "Free",
    price: "Free",
    description: "Perfect for getting started",
    features: [
      "5 analyses per month",
      "Basic SEO scoring",
      "Basic GEO scoring",
      "Chrome extension",
      "Community support",
    ],
    cta: "Get Started Free",
    ctaHref: "/register",
  },
  {
    name: "Starter",
    price: "$29",
    description: "For individual creators and bloggers",
    features: [
      "50 analyses per month",
      "Advanced SEO & GEO scoring",
      "AI content suggestions",
      "Schema generation",
      "Export reports (PDF)",
      "Email support",
    ],
    cta: "Start Free Trial",
    ctaHref: "/register",
  },
  {
    name: "Pro",
    price: "$79",
    description: "For professionals and small teams",
    features: [
      "Unlimited analyses",
      "Full site audits",
      "Competitor tracking (5 domains)",
      "AI rewriting engine",
      "API access",
      "Priority support",
      "Team seats (3 included)",
    ],
    highlighted: true,
    cta: "Start Free Trial",
    ctaHref: "/register",
  },
  {
    name: "Agency",
    price: "$199",
    description: "For agencies and large teams",
    features: [
      "Unlimited everything",
      "White-label reports",
      "Competitor tracking (25 domains)",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
      "Team seats (10 included)",
      "SSO & audit logs",
    ],
    cta: "Contact Sales",
    ctaHref: "/register",
  },
];

const stats = [
  { value: "50K+", label: "Analyses Run" },
  { value: "12K+", label: "Active Users" },
  { value: "94%", label: "Score Improvement" },
  { value: "4.8/5", label: "User Rating" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 via-white to-white" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-primary-100/30 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-6 sm:pt-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-in-up">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-sm font-medium text-primary-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500"></span>
                </span>
                Now with Google SGE & Perplexity AI support
              </div>
            </div>

            <h1 className="animate-fade-in-up animate-delay-100 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Optimize for{" "}
              <span className="bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                AI Search Engines
              </span>
            </h1>

            <p className="animate-fade-in-up animate-delay-200 mt-6 text-lg leading-relaxed text-slate-600 sm:text-xl">
              The first platform that scores and optimizes your content for both
              traditional SEO and AI-powered search engines. Get discovered by
              ChatGPT, Perplexity, Google SGE, and more.
            </p>

            <div className="animate-fade-in-up animate-delay-300 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="/register" className="btn-primary px-8 py-3.5 text-base">
                Get Started Free
              </a>
              <a href="#features" className="btn-secondary px-8 py-3.5 text-base">
                See How It Works
              </a>
            </div>

            {/* Hero gauge animation */}
            <div className="animate-fade-in-up animate-delay-400 mt-16 flex items-center justify-center gap-8 sm:gap-12">
              <ScoreGauge score={87} size={100} label="SEO Score" />
              <ScoreGauge score={72} size={130} strokeWidth={10} label="Overall" />
              <ScoreGauge score={65} size={100} label="GEO Score" />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-slate-900">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything you need to rank in the AI era
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Traditional SEO is not enough. Our platform bridges the gap between
              classic search optimization and the new world of AI-powered discovery.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="card group transition-shadow hover:shadow-md"
              >
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}
                >
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="border-y border-slate-200 bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Get actionable insights in three simple steps
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Enter Your URL",
                description:
                  "Paste any page URL and target keyword. Our engine crawls the page and extracts all relevant content signals.",
              },
              {
                step: "2",
                title: "Get Your Scores",
                description:
                  "Receive detailed SEO and GEO scores with a breakdown of what is working and what needs improvement.",
              },
              {
                step: "3",
                title: "Optimize & Track",
                description:
                  "Apply AI-powered recommendations, generate schema markup, and track your improvement over time.",
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Start free and scale as you grow. No hidden fees.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {pricingPlans.map((plan) => (
              <PricingCard key={plan.name} {...plan} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-slate-200 bg-slate-900 py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to optimize for the future of search?
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            Join thousands of content creators and SEO professionals who are
            already optimizing for AI-powered search engines.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/register"
              className="btn-primary bg-white px-8 py-3.5 text-base text-slate-900 hover:bg-slate-100"
            >
              Get Started Free
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-8 py-3.5 text-base font-semibold text-white transition-all hover:border-slate-500 hover:bg-slate-800"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 3.091A7.07 7.07 0 0112 4.93c1.688 0 3.233.59 4.45 1.572l3.518-3.518A11.944 11.944 0 0012 0z" fill="#EA4335"/>
                <path d="M23.49 12.275c0-.82-.069-1.61-.197-2.375H12v4.493h6.452a5.524 5.524 0 01-2.396 3.623l3.868 3.002c2.255-2.08 3.566-5.143 3.566-8.743z" fill="#4285F4"/>
                <path d="M5.265 14.294A7.098 7.098 0 014.93 12c0-.8.12-1.572.335-2.294L1.312 6.615A11.965 11.965 0 000 12c0 1.934.467 3.762 1.312 5.385l3.953-3.091z" fill="#FBBC05"/>
                <path d="M12 24c3.24 0 5.956-1.07 7.942-2.907l-3.868-3.002c-1.074.72-2.45 1.145-4.074 1.145a7.07 7.07 0 01-6.735-4.942l-3.953 3.091A11.944 11.944 0 0012 24z" fill="#34A853"/>
              </svg>
              Install Chrome Extension
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
