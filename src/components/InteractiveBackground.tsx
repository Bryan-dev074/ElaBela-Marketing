"use client";

import { useEffect, useRef } from "react";

/**
 * ElaBela signature background.
 * A living field of warm bokeh particles that drift constantly, lean toward the
 * cursor, and react to every click with an expanding ripple + shockwave.
 * Sits fixed behind all UI (pointer-events: none) and listens on `window`, so a
 * click anywhere — even on a button — disturbs the background too.
 */
type Particle = {
  x: number;
  y: number;
  hx: number; // home
  hy: number;
  vx: number;
  vy: number;
  r: number;
  a: number; // base alpha
  color: [number, number, number];
};

type Ripple = { x: number; y: number; t: number; life: number; max: number };

const PALETTE: [number, number, number][] = [
  [252, 235, 219], // cream
  [214, 171, 153], // nude glow
  [193, 132, 104], // terra
  [219, 176, 159], // rose nude
  [222, 194, 173], // light nude
];

export default function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
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

      const density = Math.min(90, Math.floor((width * height) / 20000));
      particles = Array.from({ length: density }, () => {
        const x = rand(0, width);
        const y = rand(0, height);
        return {
          x,
          y,
          hx: x,
          hy: y,
          vx: rand(-0.15, 0.15),
          vy: rand(-0.15, 0.15),
          r: rand(1.2, 4.2),
          a: rand(0.12, 0.5),
          color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        };
      });
    }

    function addRipple(x: number, y: number) {
      ripples.push({ x, y, t: 0, life: 70, max: Math.max(width, height) * 0.5 });
      // Shockwave: push nearby particles outward.
      const R = 260;
      for (const p of particles) {
        const dx = p.x - x;
        const dy = p.y - y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < R) {
          const force = (1 - d / R) * 9;
          p.vx += (dx / d) * force;
          p.vy += (dy / d) * force;
        }
      }
    }

    function frame() {
      ctx!.clearRect(0, 0, width, height);
      ctx!.globalCompositeOperation = "lighter";

      for (const p of particles) {
        // gentle drift + spring back toward home so the field stays balanced
        p.vx += (p.hx - p.x) * 0.0008 + rand(-0.02, 0.02);
        p.vy += (p.hy - p.y) * 0.0008 + rand(-0.02, 0.02);

        // cursor attraction
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 200) {
            const f = (1 - d / 200) * 0.4;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }

        p.vx *= 0.94;
        p.vy *= 0.94;
        p.x += p.vx;
        p.y += p.vy;

        const [r, g, b] = p.color;
        const glow = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        glow.addColorStop(0, `rgba(${r},${g},${b},${p.a})`);
        glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx!.fillStyle = glow;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
        ctx!.fill();
      }

      // connective threads near the cursor — subtle, premium
      if (mouse.active) {
        for (const p of particles) {
          const d = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (d < 150) {
            ctx!.strokeStyle = `rgba(214,171,153,${(1 - d / 150) * 0.12})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(mouse.x, mouse.y);
            ctx!.stroke();
          }
        }
      }

      // ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.t++;
        const prog = rp.t / rp.life;
        if (prog >= 1) {
          ripples.splice(i, 1);
          continue;
        }
        const radius = prog * rp.max;
        const alpha = (1 - prog) * 0.4;
        ctx!.strokeStyle = `rgba(193,132,104,${alpha})`;
        ctx!.lineWidth = 2 * (1 - prog) + 0.5;
        ctx!.beginPath();
        ctx!.arc(rp.x, rp.y, radius, 0, Math.PI * 2);
        ctx!.stroke();
        // inner echo ring
        ctx!.strokeStyle = `rgba(252,235,219,${alpha * 0.6})`;
        ctx!.beginPath();
        ctx!.arc(rp.x, rp.y, radius * 0.6, 0, Math.PI * 2);
        ctx!.stroke();
      }

      ctx!.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    }

    function onMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    }
    function onLeave() {
      mouse.active = false;
    }
    function onClick(e: MouseEvent) {
      addRipple(e.clientX, e.clientY);
    }
    function onResize() {
      build();
    }

    build();

    if (reduced) {
      // Static, calm rendering: draw the field once, no motion, but still ripple on click.
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

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("click", onClick);
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
          "radial-gradient(1200px 700px at 78% -10%, rgba(113,69,63,0.55), transparent 60%)," +
          "radial-gradient(900px 600px at 12% 110%, rgba(193,132,104,0.22), transparent 55%)," +
          "linear-gradient(180deg, #160d0c 0%, #1b100e 60%, #160d0c 100%)",
      }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      {/* fine grain overlay for depth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
