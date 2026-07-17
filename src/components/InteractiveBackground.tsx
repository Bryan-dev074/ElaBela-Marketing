"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo «aurora glass» ultraliviano (reemplaza al canvas de partículas):
 * capas de luz de marca que derivan en loop constante + un foco que sigue al
 * cursor. Todo se anima solo con transform/opacity (compositor de la GPU) —
 * cero trabajo por frame en JS, apto para máquinas lentas. El click dispara
 * una onda CSS puntual que se autodescarta.
 */
export default function InteractiveBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const light = lightRef.current;
    if (!root || !light) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;

    const move = (e: MouseEvent) => {
      light.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      if (light.style.opacity !== "1") light.style.opacity = "1";
    };
    const leave = () => {
      light.style.opacity = "0";
    };
    const click = (e: MouseEvent) => {
      if (reduced) return;
      const r = document.createElement("div");
      r.className = "bg-ripple";
      r.style.left = e.clientX + "px";
      r.style.top = e.clientY + "px";
      root.appendChild(r);
      r.addEventListener("animationend", () => r.remove(), { once: true });
    };

    if (fine) {
      window.addEventListener("mousemove", move, { passive: true });
      document.addEventListener("mouseleave", leave);
    }
    window.addEventListener("click", click, { passive: true });
    return () => {
      window.removeEventListener("mousemove", move);
      document.removeEventListener("mouseleave", leave);
      window.removeEventListener("click", click);
    };
  }, []);

  return (
    <div ref={rootRef} aria-hidden className="bg-noir">
      <div className="bg-aurora bg-aurora-a" />
      <div className="bg-aurora bg-aurora-b" />
      <div className="bg-aurora bg-aurora-c" />
      <div ref={lightRef} className="bg-cursor-light" />
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
