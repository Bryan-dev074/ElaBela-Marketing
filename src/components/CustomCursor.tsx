"use client";

import { useEffect, useRef } from "react";

/**
 * Premium custom cursor: a precise dot + a trailing ring that grows and turns
 * nude over interactive elements and shrinks on press. Fine-pointer devices only;
 * inputs keep the native text caret so typing stays natural.
 *
 * Elements can tint the ring and attach a floating label via data attributes:
 *   <div data-cursor-color="#3b82f6" data-cursor-label="En curso">…</div>
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    const tag = tagRef.current;
    if (!dot || !ring || !tag) return;

    let mx = -100, my = -100, rx = -100, ry = -100;
    let raf = 0;

    const move = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      if (ring.dataset.visible !== "1") { ring.dataset.visible = "1"; dot.dataset.visible = "1"; }
    };
    const over = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const t = target?.closest?.('a,button,input,select,textarea,label,[role="button"],[data-cursor],[data-cursor-label]');
      ring.dataset.hover = t ? "1" : "0";

      // Contextual tint + label bubble (inherited from the nearest annotated ancestor)
      const meta = target?.closest?.("[data-cursor-label],[data-cursor-color]") as HTMLElement | null;
      const color = meta?.getAttribute("data-cursor-color") || "";
      const label = meta?.getAttribute("data-cursor-label") || "";
      if (color) {
        ring.style.setProperty("--cursor-accent", color);
        tag.style.setProperty("--cursor-accent", color);
      } else {
        ring.style.removeProperty("--cursor-accent");
        tag.style.removeProperty("--cursor-accent");
      }
      if (label) {
        tag.textContent = label;
        tag.dataset.visible = "1";
      } else {
        tag.dataset.visible = "0";
      }
    };
    const down = () => (ring.dataset.down = "1");
    const up = () => (ring.dataset.down = "0");
    const leave = () => { ring.dataset.visible = "0"; dot.dataset.visible = "0"; tag.dataset.visible = "0"; };
    const loop = () => {
      rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      tag.style.transform = `translate(${rx + 22}px, ${ry + 18}px)`;
      raf = requestAnimationFrame(loop);
    };

    document.body.classList.add("has-custom-cursor");
    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseover", over, { passive: true });
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    document.addEventListener("mouseleave", leave);
    loop();

    return () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove("has-custom-cursor");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      document.removeEventListener("mouseleave", leave);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" data-visible="0" aria-hidden />
      <div ref={ringRef} className="cursor-ring" data-visible="0" data-hover="0" data-down="0" aria-hidden />
      <div ref={tagRef} className="cursor-tag" data-visible="0" aria-hidden />
    </>
  );
}
