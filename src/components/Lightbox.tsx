"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { containTabFocus } from "@/lib/focus-management";
import { cursorIntentProps } from "@/lib/cursor-intent";

const EMPTY_IMAGES: string[] = [];
const EMPTY_LABELS: string[] = [];

/**
 * Fullscreen image/GIF viewer: click any thumbnail in the app to inspect it
 * in place. Closes with Escape, backdrop click or the ✕ button.
 */
export function Lightbox({
  src,
  images = EMPTY_IMAGES,
  alts = EMPTY_LABELS,
  captions = EMPTY_LABELS,
  initialIndex = 0,
  alt = "",
  caption,
  onClose,
}: {
  src?: string | null;
  images?: string[];
  alts?: string[];
  captions?: string[];
  initialIndex?: number;
  alt?: string;
  caption?: string;
  onClose: () => void;
}) {
  const sources = images.length > 0 ? images : src ? [src] : EMPTY_IMAGES;
  const imageCount = sources.length;
  const open = imageCount > 0;
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const captionId = useId();

  useEffect(() => {
    setActiveIndex(imageCount > 0 ? ((initialIndex % imageCount) + imageCount) % imageCount : 0);
  }, [imageCount, initialIndex]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => {
    if (imageCount === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowLeft" && imageCount > 1) {
        setActiveIndex((current) => (current - 1 + imageCount) % imageCount);
      } else if (e.key === "ArrowRight" && imageCount > 1) {
        setActiveIndex((current) => (current + 1) % imageCount);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [imageCount, onClose]);

  if (typeof document === "undefined") return null;
  const activeSrc = sources[activeIndex];
  const activeCaption = captions[activeIndex] ?? caption;
  const imageAlt = alts[activeIndex] ?? (imageCount > 1 ? `${alt} ${activeIndex + 1}` : alt);
  return createPortal(
    <AnimatePresence>
      {activeSrc ? (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby={activeCaption ? captionId : undefined}
          aria-label={activeCaption ? undefined : imageAlt || "Vista ampliada"}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (dialogRef.current) containTabFocus(event, dialogRef.current);
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />
          <motion.figure
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex max-h-full max-w-4xl flex-col items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeSrc} alt={imageAlt} className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-pop" />
            {activeCaption ? <figcaption id={captionId} className="glow-text mt-3 text-center text-xs font-medium">{activeCaption}</figcaption> : null}
            {imageCount > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveIndex((current) => (current - 1 + imageCount) % imageCount)}
                  aria-label="Imagen anterior"
                  className="press absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white backdrop-blur transition-colors hover:border-nude/50 sm:-left-16"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex((current) => (current + 1) % imageCount)}
                  aria-label="Imagen siguiente"
                  className="press absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white backdrop-blur transition-colors hover:border-nude/50 sm:-right-16"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
                <span className="num mt-2 rounded-full border border-white/10 bg-black/65 px-3 py-1 text-[10px] font-medium tabular-nums text-white/75">
                  {activeIndex + 1} / {imageCount}
                </span>
              </>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              {...cursorIntentProps("open", "Cerrar")}
              className="press absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white backdrop-blur transition-colors hover:border-nude/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nude"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.figure>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
