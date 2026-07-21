"use client";

import { useEffect, useRef } from "react";
import { resolveCursorTarget } from "@/lib/cursor-intent";

/**
 * Premium custom cursor: a precise dot + a ring that grows and turns nude over
 * interactive elements and shrinks on press. Everything tracks the mouse
 * INSTANTLY (transform set directly on mousemove — no RAF loop, no trailing
 * lerp), so it stays fluid even on slow machines. Fine-pointer devices only;
 * inputs keep the native text caret so typing stays natural.
 *
 * Actionable elements describe their semantics with data-cursor. Legacy labels
 * and colors remain supported when they belong to the active action itself.
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
      const target = e.target instanceof Element ? e.target : null;
      const resolved = resolveCursorTarget(target);
      ring.dataset.hover = resolved.interactive ? "1" : "0";

      if (resolved.interactive) {
        ring.style.setProperty("--cursor-accent", resolved.color);
        tag.style.setProperty("--cursor-accent", resolved.color);
        tag.textContent = resolved.label;
        tag.dataset.visible = "1";
      } else {
        ring.style.removeProperty("--cursor-accent");
        tag.style.removeProperty("--cursor-accent");
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
