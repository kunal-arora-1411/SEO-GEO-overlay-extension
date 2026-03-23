"use client";

import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  targetOpacity: number;
  color: string;
  life: number;
  maxLife: number;
}

interface FloatingParticlesProps {
  className?: string;
}

export default function FloatingParticles({ className = "" }: FloatingParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });

  const colors = ["#3b82f6", "#60a5fa", "#a78bfa", "#f472b6"]; // Blue, Sky, Purple, Pink

  const createParticle = useCallback((x: number, y: number): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 0.4 + 0.1;
    return {
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 40,
      size: Math.random() * 1.5 + 0.5,
      speedX: Math.cos(angle) * speed,
      speedY: Math.sin(angle) * speed - 0.1,
      opacity: 0,
      targetOpacity: Math.random() * 0.5 + 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0,
      maxLife: 150 + Math.random() * 100,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
    };
    const handleMouseLeave = () => { mouseRef.current.active = false; };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseenter", () => { mouseRef.current.active = true; });
    canvas.addEventListener("mouseleave", handleMouseLeave);

    let frame = 0;

    const animate = () => {
      const cw = canvas.offsetWidth;
      const ch = canvas.offsetHeight;
      ctx.clearRect(0, 0, cw, ch);
      const mouse = mouseRef.current;
      frame++;

      // Draw subtle grid
      ctx.strokeStyle = "rgba(59, 130, 246, 0.035)";
      ctx.lineWidth = 0.5;
      const gridSize = 45;
      for (let x = 0; x < cw; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
      }
      for (let y = 0; y < ch; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
      }

      // Auto-spawn some background nodes randomly
      if (frame % 8 === 0 && particlesRef.current.length < 120) {
        particlesRef.current.push(createParticle(Math.random() * cw, Math.random() * ch));
      }

      // Cursor spawn
      if (mouse.active && frame % 2 === 0 && particlesRef.current.length < 350) {
        particlesRef.current.push(createParticle(mouse.x, mouse.y));
      }

      // Update and draw connections
      ctx.lineWidth = 0.55;
      const maxDist = 150;
      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const p1 = particlesRef.current[i];
          const p2 = particlesRef.current[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.22 * Math.min(p1.opacity, p2.opacity);
            ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life++;
        const fadeIn = Math.min(p.life / 30, 1);
        const fadeOut = Math.max((p.maxLife - p.life) / 40, 0);
        p.opacity = p.targetOpacity * Math.min(fadeIn, fadeOut);

        p.x += p.speedX;
        p.y += p.speedY;

        if (p.life >= p.maxLife) return false;

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.restore();

        return true;
      });

      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [createParticle]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-auto cursor-default ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}
