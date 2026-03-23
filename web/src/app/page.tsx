"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollReveal, { StaggerContainer, StaggerItem } from "@/components/ScrollReveal";
import FloatingParticles from "@/components/FloatingParticles";
import MagneticButton from "@/components/MagneticButton";
import ScrollProgress from "@/components/ScrollProgress";
import ParallaxSection from "@/components/ParallaxSection";
import AnimatedCounter from "@/components/AnimatedCounter";
import ScrollTutorial from "@/components/ScrollTutorial";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const features = [
  {
    title: "Deep SEO Analysis",
    description: "Comprehensive analysis of on-page SEO factors including meta tags, headings, content structure, and technical performance.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M12 12l4-4" />
      </svg>
    ),
  },
  {
    title: "Generative Engine Scoring",
    description: "Evaluate how your content performs for AI-powered search engines like ChatGPT, Perplexity, and Google SGE.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    title: "AI Rewriting Engine",
    description: "Get AI-powered content suggestions that maintain your voice while improving discoverability across all channels.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    ),
  },
  {
    title: "Schema Generation",
    description: "Automatically generate structured data markup to help search engines and AI assistants understand your content.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
];

const headlineWords = "Experience liftoff with AI search optimization".split(" ");

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty("--mouse-x", `${x}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <div className="min-h-screen bg-ai-gradient relative overflow-x-hidden">
      {/* Subtle background overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30 bg-white/40" />
      <ScrollProgress />
      <Navbar />

      <main>
        {/* Hero */}
        <section className="relative pt-32 pb-24 lg:pt-44 lg:pb-36 px-4 sm:px-6 lg:px-8 mx-auto max-w-6xl overflow-hidden">
          <div className="absolute inset-0 -top-16">
            {mounted && <FloatingParticles />}
          </div>

          <ParallaxSection offset={-60} speed={0.5} className="text-center max-w-4xl mx-auto relative z-10">
            <ScrollReveal>
              <div className="flex items-center justify-center gap-2 mb-10">
                <span className="text-lg font-medium tracking-tight text-slate-400">SEO & GEO Optimizer</span>
              </div>
            </ScrollReveal>

            {/* Typewriter Typography */}
            <h1 className="text-[3.2rem] md:text-[4.5rem] lg:text-[5rem] font-medium tracking-[-0.02em] leading-[1.05] text-slate-900 mb-10 min-h-[2.1em] md:min-h-[2.15em]">
              {"Experience liftoff with AI search optimization".split("").map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: 0.01,
                    delay: i * 0.04,
                    ease: "linear",
                  }}
                >
                  {char}
                </motion.span>
              ))}
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 45 * 0.04, // Start blinking after typing finishes
                }}
                className="inline-block w-[3px] h-[0.9em] bg-primary-500 ml-1 translate-y-1"
              />
            </h1>

            <ScrollReveal delay={0.6}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-12">
                <MagneticButton>
                  <Link href="/register" className="btn-primary text-base px-8 py-4 gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Get Started Free
                  </Link>
                </MagneticButton>
                <MagneticButton strength={0.15}>
                  <Link href="#features" className="btn-secondary text-base px-8 py-4">
                    Explore features
                  </Link>
                </MagneticButton>
              </div>
            </ScrollReveal>
          </ParallaxSection>
        </section>

        <ScrollTutorial />

        {/* Wave Divider */}
        <div className="w-full text-slate-50/70">
          <svg viewBox="0 0 1440 100" fill="currentColor" preserveAspectRatio="none" className="w-full h-12 md:h-24 block">
            <path d="M0,0 C320,80 420,80 720,40 C1020,0 1120,0 1440,40 L1440,100 L0,100 Z" />
          </svg>
        </div>

        {/* Features (Now starting with bg-slate-50/70) */}
        <section id="features" className="py-24 bg-slate-50/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ParallaxSection offset={20} speed={0.3}>
              <ScrollReveal className="text-center max-w-xl mx-auto mb-20">
                <h2 className="text-3xl md:text-[2.8rem] font-medium tracking-tight text-slate-900 leading-tight">
                  Built for the new era of search
                </h2>
              </ScrollReveal>
            </ParallaxSection>

            <StaggerContainer className="grid md:grid-cols-2 gap-6" staggerDelay={0.15}>
              {features.map((feature, i) => (
                <StaggerItem key={i}>
                  <ParallaxSection offset={10 * (i % 2 === 0 ? 1 : -0.5)} speed={0.2}>
                    <div 
                      className="card-glass group spotlight-card p-[1px] rounded-[17px] cursor-default bg-slate-200"
                      onMouseMove={handleCardMouseMove}
                    >
                      <div className="spotlight-content p-8">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-6 text-slate-500 group-hover:bg-primary-50 group-hover:text-primary-600 group-hover:scale-110 transition-all duration-300">
                          {feature.icon}
                        </div>
                        <h3 className="text-xl font-medium text-slate-900 mb-3">{feature.title}</h3>
                        <p className="text-slate-500 leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  </ParallaxSection>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>

        {/* Another wave */}
        <div className="w-full text-slate-50/70 relative rotate-180">
          <svg viewBox="0 0 1440 100" fill="currentColor" preserveAspectRatio="none" className="w-full h-12 md:h-24 block">
            <path d="M0,0 C320,80 420,80 720,40 C1020,0 1120,0 1440,40 L1440,100 L0,100 Z" />
          </svg>
        </div>

        {/* How It Works */}
        <section className="py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <ParallaxSection offset={30} speed={0.4}>
              <ScrollReveal className="text-center max-w-xl mx-auto mb-24">
                <h2 className="text-3xl md:text-[2.8rem] font-medium tracking-tight text-slate-900 leading-tight">
                  Three steps to better rankings
                </h2>
              </ScrollReveal>
            </ParallaxSection>

            <StaggerContainer className="grid md:grid-cols-3 gap-12" staggerDelay={0.2}>
              {[
                { step: "01", title: "Enter your URL", description: "Paste any page URL and keyword. Our engine analyzes every content signal." },
                { step: "02", title: "Review your scores", description: "Get detailed SEO and GEO scores with clear, actionable breakdowns." },
                { step: "03", title: "Optimize & ship", description: "Apply AI recommendations, add schema markup, and track improvements." },
              ].map((item) => (
                <StaggerItem key={item.step} className="text-center relative group">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-12 bg-gradient-to-b from-transparent to-primary-200 group-hover:to-primary-500 transition-colors duration-500" />
                  <div className="pt-16 pb-4">
                    <div className="text-sm font-mono text-primary-500 tracking-widest mb-5">{item.step}</div>
                    <h3 className="text-xl font-medium text-slate-900 mb-3">{item.title}</h3>
                    <p className="text-slate-500 leading-relaxed">{item.description}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>

        {/* Stats */}
        <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at center, #3b82f6 0%, transparent 70%)" }} />
          
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-10" staggerDelay={0.15}>
              {[
                { value: 50000, suffix: "+", label: "Analyses" },
                { value: 12000, suffix: "+", label: "Users" },
                { value: 94, suffix: "%", label: "Improvement" },
                { value: 4.8, suffix: "", label: "Rating" },
              ].map((stat, i) => (
                <StaggerItem key={i} className="text-center">
                  <div className="text-4xl md:text-5xl font-medium tracking-tight mb-2">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm text-slate-400 tracking-wide uppercase">{stat.label}</div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 relative">
          <ParallaxSection offset={-20} speed={0.4}>
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <ScrollReveal>
                <h2 className="text-3xl md:text-[3.2rem] font-medium tracking-tight text-slate-900 leading-tight mb-6">
                  Ready to get started?
                </h2>
                <p className="text-lg md:text-xl text-slate-500 mb-12 max-w-lg mx-auto leading-relaxed">
                  Join thousands already optimizing for AI-powered search.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <MagneticButton>
                    <Link href="/register" className="btn-primary text-base px-9 py-4.5 shadow-lg shadow-primary-500/20">
                      Get Started Free
                    </Link>
                  </MagneticButton>
                  <MagneticButton strength={0.2}>
                    <Link href="/pricing" className="btn-secondary text-base px-9 py-4.5">
                      View Pricing
                    </Link>
                  </MagneticButton>
                </div>
              </ScrollReveal>
            </div>
          </ParallaxSection>
        </section>
      </main>

      <Footer />
    </div>
  );
}
