"use client";

import { useRef, ReactNode } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

interface ParallaxSectionProps {
  children: ReactNode;
  className?: string;
  offset?: number;
  direction?: "up" | "down" | "left" | "right";
  speed?: number;
}

export default function ParallaxSection({
  children,
  className = "",
  offset = 50,
  direction = "up",
  speed = 1,
}: ParallaxSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const springScroll = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const distance = offset * speed;

  // Map progress (0 to 1) to distance
  // 'up' means element goes up as we scroll down (standard parallax)
  const yValues = direction === "up" ? [distance, -distance] : direction === "down" ? [-distance, distance] : [0, 0];
  const xValues = direction === "left" ? [distance, -distance] : direction === "right" ? [-distance, distance] : [0, 0];

  const y = useTransform(springScroll, [0, 1], yValues);
  const x = useTransform(springScroll, [0, 1], xValues);

  return (
    <div ref={ref} className={className}>
      <motion.div style={{ x, y }} className="w-full h-full">
        {children}
      </motion.div>
    </div>
  );
}
