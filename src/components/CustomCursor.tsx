"use client";

import { useEffect, useRef } from "react";

/**
 * Premium custom cursor: a precise dot + a trailing ring that grows and turns
 * nude over interactive elements and shrinks on press. Fine-pointer devices only;
 * inputs keep the native text caret so typing stays natural.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mx = -100, my = -100, rx = -100, ry = -100;
    let raf = 0;

    const move = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      if (ring.dataset.visible !== "1") { ring.dataset.visible = "1"; dot.dataset.visible = "1"; }
    };
    const over = (e: MouseEvent) => {
      const t = (e.target as HTMLElement)?.closest?.('a,button,input,select,textarea,label,[role="button"],[data-cursor]');
      ring.dataset.hover = t ? "1" : "0";
    };
    const down = () => (ring.dataset.down = "1");
    const up = () => (ring.dataset.down = "0");
    const leave = () => { ring.dataset.visible = "0"; dot.dataset.visible = "0"; };
    const loop = () => {
      rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
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
    </>
  );
}
