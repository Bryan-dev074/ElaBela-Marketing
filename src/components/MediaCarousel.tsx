"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";

export interface MediaCarouselProps {
  images: string[];
  alt: string;
  intervalMs?: number;
  onOpen?: (index: number) => void;
}

export function MediaCarousel({ images, alt, intervalMs = 1500, onOpen }: MediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const imageCount = images.length;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(query.matches);
    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    setActiveIndex((current) => imageCount > 0 ? current % imageCount : 0);
  }, [imageCount]);

  useEffect(() => {
    if (reducedMotion || imageCount < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % imageCount);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [imageCount, intervalMs, reducedMotion]);

  if (imageCount === 0) return null;

  const previous = () => setActiveIndex((current) => (current - 1 + imageCount) % imageCount);
  const next = () => setActiveIndex((current) => (current + 1) % imageCount);
  const activeImage = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[activeIndex]}
        alt={`${alt} ${activeIndex + 1}`}
        className="h-full max-h-64 w-full object-contain transition-opacity duration-200 motion-reduce:transition-none"
      />
      {onOpen ? (
        <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/65 text-white/75 opacity-0 backdrop-blur transition-opacity duration-200 group-hover/media:opacity-100 group-focus-visible/media:opacity-100 motion-reduce:transition-none">
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </span>
      ) : null}
    </>
  );

  return (
    <div className="relative isolate h-full min-h-40 overflow-hidden bg-black/25">
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(activeIndex)}
          className="group/media flex h-full min-h-40 w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-nude"
          aria-label={`Ampliar ${alt} ${activeIndex + 1}`}
        >
          {activeImage}
        </button>
      ) : (
        <div className="flex h-full min-h-40 w-full items-center justify-center">{activeImage}</div>
      )}

      {imageCount > 1 ? (
        <>
          <button
            type="button"
            onClick={previous}
            aria-label="Imagen anterior"
            className="press absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white backdrop-blur transition-colors hover:border-white/25 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nude"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Imagen siguiente"
            className="press absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white backdrop-blur transition-colors hover:border-white/25 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nude"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 backdrop-blur">
            <div className="flex gap-1.5" aria-hidden="true">
              {images.map((image, index) => (
                <span
                  key={`${image}-${index}`}
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none ${
                    index === activeIndex ? "w-4 bg-nude" : "w-1.5 bg-white/35"
                  }`}
                />
              ))}
            </div>
            <span className="num text-[10px] font-medium tabular-nums text-white/75">
              {activeIndex + 1} / {imageCount}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
