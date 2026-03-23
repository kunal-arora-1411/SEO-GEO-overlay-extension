"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export default function AnimatedCounter({
  value,
  suffix = "",
  duration = 1.8,
  className = "",
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!isInView) return;

    const start = performance.now();
    const durationMs = duration * 1000;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = easeOutExpo(progress);
      const current = Math.round(eased * value);

      if (value >= 1000) {
        setDisplay((current / 1000).toFixed(current >= value ? 0 : 1) + "K");
      } else if (value < 10) {
        setDisplay((eased * value).toFixed(1));
      } else {
        setDisplay(String(current));
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Set final display
        if (value >= 1000) {
          setDisplay((value / 1000) + "K");
        } else if (value < 10) {
          setDisplay(value.toFixed(1));
        } else {
          setDisplay(String(value));
        }
      }
    };

    requestAnimationFrame(tick);
  }, [isInView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {display}{suffix}
    </span>
  );
}
