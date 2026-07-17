"use client";

import { useEffect, useRef } from "react";

/**
 * Premium custom cursor: a precise dot + a ring that grows and turns nude over
 * interactive elements and shrinks on press. Everything tracks the mouse
 * INSTANTLY (transform set directly on mousemove — no RAF loop, no trailing
 * lerp), so it stays fluid even on slow machines. Fine-pointer devices only;
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

    const move = (e: MouseEvent) => {
      const t = `translate(${e.clientX}px, ${e.clientY}px)`;
      dot.style.transform = t;
      ring.style.transform = t;
      tag.style.transform = `translate(${e.clientX + 22}px, ${e.clientY + 18}px)`;
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

    document.body.classList.add("has-custom-cursor");
    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mouseover", over, { passive: true });
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    document.addEventListener("mouseleave", leave);

    return () => {
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
