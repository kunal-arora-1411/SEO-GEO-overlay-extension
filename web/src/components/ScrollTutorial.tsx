"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";

const tutorialSteps = [
  {
    id: "scanning",
    label: "Phase 01",
    title: "Deep Search Analysis",
    description: "Crawl and index your site content through the lens of traditional and generative search models.",
    content: (
      <div className="h-full flex flex-col p-8 font-mono">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-500 text-sm tracking-widest uppercase">Scanner Active</span>
          </div>
          <span className="text-slate-500 text-xs">v4.2.0-stable</span>
        </div>
        
        <div className="flex-1 space-y-6">
          <div className="space-y-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-tighter">Target URL</div>
            <div className="text-sm text-slate-300">https://example.com/blog/future-of-ai</div>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
              <div className="text-[10px] text-slate-500 mb-1">Semantic Depth</div>
              <div className="text-xl font-bold text-white">4.8<span className="text-slate-600 text-xs ml-1">/5.0</span></div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5">
              <div className="text-[10px] text-slate-500 mb-1">Indexing Status</div>
              <div className="text-xl font-bold text-emerald-400">Complete</div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-[10px] text-slate-500 uppercase">
              <span>Tokenizing Content</span>
              <span>84%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "84%" }}
                className="h-full bg-emerald-400"
              />
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "scoring",
    label: "Phase 02",
    title: "GEO Visibility Scoring",
    description: "Real-time metrics on how your content ranks within AI response engines like ChatGPT and Perplexity.",
    content: (
      <div className="h-full flex flex-col p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-mono uppercase tracking-widest">
            AI Connectivity Matrix
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-slate-400 text-xs font-mono">Live Sync</span>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="relative mb-6">
            <svg className="w-48 h-48 transform -rotate-90">
              <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-800" />
              <motion.circle 
                cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="4" fill="transparent" 
                strokeDasharray={552.92}
                initial={{ strokeDashoffset: 552.92 }}
                animate={{ strokeDashoffset: 552.92 * (1 - 0.92) }}
                className="text-blue-500" 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold text-white tracking-tighter">92</span>
              <span className="text-slate-500 text-[10px] uppercase font-mono mt-1">Global Score</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3 w-full mt-4">
            {["ChatGPT", "Claude", "SGE"].map(bot => (
              <div key={bot} className="p-3 rounded-xl bg-slate-900 border border-white/5">
                <div className="text-[10px] text-slate-500 mb-1">{bot}</div>
                <div className="text-xs font-bold text-white">94%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  },
  {
    id: "optimization",
    label: "Phase 03",
    title: "AI-Powered Optimization",
    description: "Dynamic content re-structuring tailored for maximum citation probability in generative results.",
    content: (
      <div className="h-full flex flex-col p-8 font-mono overflow-hidden">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-2 h-2 rounded-full bg-primary-500" />
          <span className="text-primary-400 text-xs uppercase tracking-widest">Synthesizing Improvements</span>
        </div>
        
        <div className="flex-1 space-y-8">
          <div className="relative">
            <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-tighter">Source Content</div>
            <div className="p-4 rounded-xl bg-slate-900 border border-white/5 text-xs text-slate-400 leading-relaxed italic">
              "AI is changing everything in search and content marketing strategies today..."
            </div>
          </div>
          
          <div className="flex justify-center -my-4 relative z-10">
            <motion.div 
              animate={{ y: [0, 5, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-500/20"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>
            </motion.div>
          </div>
          
          <div className="relative">
             <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-primary-400 uppercase tracking-tighter font-bold">Optimized Output</div>
              <div className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[8px] text-emerald-400">CITABLE +42%</div>
            </div>
            <div className="p-4 rounded-xl bg-primary-500/5 border border-primary-500/20 text-xs text-white leading-relaxed font-sans">
              "Large Language Models (LLMs) are <span className="text-primary-400 font-bold decoration-underline">fundamentally restructuring</span> the digital discovery landscape through semantic synthesis."
            </div>
          </div>
        </div>
      </div>
    )
  }
];

export default function ScrollTutorial() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Scale and expansion effects
  const scale = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0.85, 1, 1, 0.95]);
  const opacity = useTransform(scrollYProgress, [0, 0.05, 0.95, 1], [0, 1, 1, 0]);
  const innerScale = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0.98, 1, 1, 0.98]);

  // Use useMotionValueEvent for more robust scroll tracking
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (v) => {
      console.log("Scroll Progress:", v); // Debugging aid
      if (v < 0.25) setActiveStep(0);
      else if (v < 0.55) setActiveStep(1);
      else setActiveStep(2);
    });
    return () => unsubscribe();
  }, [scrollYProgress]);

  return (
    <div ref={containerRef} className="relative h-[600vh] bg-slate-50/50">
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-start overflow-hidden px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        
        {/* Floating Text Overlays */}
        <div className="mb-12 w-full max-w-4xl z-20 pointer-events-none relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="text-center space-y-3 md:space-y-4 px-6"
            >
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-medium tracking-tight text-slate-900 leading-tight">
                {tutorialSteps[activeStep].title}
              </h2>
              <p className="text-slate-600 max-w-xl mx-auto text-xs sm:text-sm md:text-base leading-relaxed">
                {tutorialSteps[activeStep].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* The "Black Box" Main Focus */}
        <motion.div
          style={{ scale, opacity }}
          className="w-full max-w-6xl aspect-[16/10] md:aspect-[16/9] lg:aspect-[21/9] bg-slate-950 rounded-2xl md:rounded-[2.5rem] border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative z-10"
        >
          {/* Header Bar */}
          <div className="h-12 border-b border-white/5 bg-white/5 flex items-center px-6 justify-between shrink-0">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-white/10" />
              <div className="w-3 h-3 rounded-full bg-white/10" />
              <div className="w-3 h-3 rounded-full bg-white/10" />
            </div>
            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-4">
              <span className="hidden sm:inline">SEO-GEO-OPTIMIZER.PRO.V4</span>
              <div className="px-2 py-0.5 rounded bg-white/10 text-slate-400">0.0.127.1</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-white/5" />
              <div className="w-4 h-4 rounded bg-white/5" />
            </div>
          </div>

          {/* Sub-Header with step indicators */}
          <div className="h-14 border-b border-white/5 flex items-center px-6 shrink-0 bg-[#0a0a0b]">
            <div className="flex gap-6 md:gap-10">
              {tutorialSteps.map((step, i) => (
                <button 
                  key={step.id} 
                  className={`relative flex items-center gap-2 text-xs font-mono transition-colors ${
                    i === activeStep ? "text-white" : "text-slate-500"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === activeStep ? "bg-primary-500" : "bg-transparent border border-slate-700"
                  }`} />
                  {step.id.toUpperCase()}
                  {i === activeStep && (
                    <motion.div 
                      layoutId="active-tab" 
                      className="absolute -bottom-[20px] left-0 right-0 h-0.5 bg-primary-500" 
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Viewport */}
          <div className="flex-1 overflow-hidden relative">
            <motion.div style={{ scale: innerScale }} className="h-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 1.02, filter: "blur(10px)" }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full"
                >
                  {tutorialSteps[activeStep].content}
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* Subtle light leak effect */}
            <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-primary-500/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-1/2 h-1/2 bg-blue-500/5 blur-[120px] pointer-events-none" />
          </div>

          {/* Status Footer */}
          <div className="h-8 bg-black/40 border-t border-white/5 px-6 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-4 text-[9px] text-slate-500 font-mono">
                <span className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" /> 
                  ENGINE_READY
                </span>
                <span>CPU: 14%</span>
                <span>MEM: 1.2GB</span>
             </div>
             <div className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">
               Encrypted Session
             </div>
          </div>
        </motion.div>

        {/* Dynamic Background Glow behind the box */}
        <motion.div 
           style={{ opacity }}
           className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary-500/5 blur-[200px] -z-10 pointer-events-none"
        />
      </div>
    </div>
  );
}
