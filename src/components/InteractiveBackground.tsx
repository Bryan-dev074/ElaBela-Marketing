"use client";

import { useEffect, useRef } from "react";

/**
 * Premium noir background.
 * A subtle field of silver/graphite bokeh that drifts, leans toward the cursor,
 * and answers every click with an expanding ripple + shockwave. Fixed behind all
 * UI (pointer-events: none) and listens on `window`, so a click anywhere reacts.
 */
type Particle = {
  x: number; y: number; hx: number; hy: number;
  vx: number; vy: number; r: number; a: number;
  color: [number, number, number];
};
type Ripple = { x: number; y: number; t: number; life: number; max: number };

const PALETTE: [number, number, number][] = [
  [255, 255, 255],
  [214, 216, 224],
  [176, 180, 196],
  [140, 146, 168],
  [214, 171, 153], // faint nude sparkle, used rarely
];

export default function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0, height = 0, dpr = 1;
    let particles: Particle[] = [];
    const ripples: Ripple[] = [];
    const mouse = { x: -9999, y: -9999, active: false };
    let raf = 0;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = width + "px";
      canvas!.style.height = height + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const density = Math.min(80, Math.floor((width * height) / 24000));
      particles = Array.from({ length: density }, () => {
        const x = rand(0, width), y = rand(0, height);
        const nude = Math.random() < 0.12;
        return {
          x, y, hx: x, hy: y,
          vx: rand(-0.12, 0.12), vy: rand(-0.12, 0.12),
          r: rand(1, 3.4),
          a: nude ? rand(0.1, 0.25) : rand(0.06, 0.3),
          color: nude ? PALETTE[4] : PALETTE[Math.floor(Math.random() * 4)],
        };
      });
    }

    function addRipple(x: number, y: number) {
      ripples.push({ x, y, t: 0, life: 60, max: Math.max(width, height) * 0.45 });
      const R = 240;
      for (const p of particles) {
        const dx = p.x - x, dy = p.y - y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < R) {
          const force = (1 - d / R) * 8;
          p.vx += (dx / d) * force;
          p.vy += (dy / d) * force;
        }
      }
    }

    function frame() {
      ctx!.clearRect(0, 0, width, height);
      ctx!.globalCompositeOperation = "lighter";
      for (const p of particles) {
        p.vx += (p.hx - p.x) * 0.0008 + rand(-0.015, 0.015);
        p.vy += (p.hy - p.y) * 0.0008 + rand(-0.015, 0.015);
        if (mouse.active) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 190) {
            const f = (1 - d / 190) * 0.35;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }
        p.vx *= 0.94; p.vy *= 0.94;
        p.x += p.vx; p.y += p.vy;
        const [r, g, b] = p.color;
        const glow = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        glow.addColorStop(0, `rgba(${r},${g},${b},${p.a})`);
        glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx!.fillStyle = glow;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
        ctx!.fill();
      }
      if (mouse.active) {
        for (const p of particles) {
          const d = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (d < 140) {
            ctx!.strokeStyle = `rgba(255,255,255,${(1 - d / 140) * 0.08})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(mouse.x, mouse.y);
            ctx!.stroke();
          }
        }
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.t++;
        const prog = rp.t / rp.life;
        if (prog >= 1) { ripples.splice(i, 1); continue; }
        const radius = prog * rp.max;
        const alpha = (1 - prog) * 0.35;
        ctx!.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx!.lineWidth = 1.5 * (1 - prog) + 0.4;
        ctx!.beginPath();
        ctx!.arc(rp.x, rp.y, radius, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.strokeStyle = `rgba(214,171,153,${alpha * 0.7})`;
        ctx!.beginPath();
        ctx!.arc(rp.x, rp.y, radius * 0.55, 0, Math.PI * 2);
        ctx!.stroke();
      }
      ctx!.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    }

    const onMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; };
    const onLeave = () => { mouse.active = false; };
    const onClick = (e: MouseEvent) => addRipple(e.clientX, e.clientY);
    const onResize = () => build();

    build();
    if (reduced) {
      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        const [r, g, b] = p.color;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        glow.addColorStop(0, `rgba(${r},${g},${b},${p.a})`);
        glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    } else {
      raf = requestAnimationFrame(frame);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("click", onClick, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{
        background:
          "radial-gradient(1100px 640px at 82% -12%, rgba(60,62,74,0.5), transparent 60%)," +
          "radial-gradient(820px 560px at 8% 112%, rgba(40,42,52,0.6), transparent 55%)," +
          "linear-gradient(180deg, #08080a 0%, #0b0b0e 55%, #08080a 100%)",
      }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
