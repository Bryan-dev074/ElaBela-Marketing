"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * Fullscreen image/GIF viewer: click any thumbnail in the app to inspect it
 * in place. Closes with Escape, backdrop click or the ✕ button.
 */
export function Lightbox({
  src,
  alt = "",
  caption,
  onClose,
}: {
  src: string | null;
  alt?: string;
  caption?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [src, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {src && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-10">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
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
            <img src={src} alt={alt} className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-pop" />
            {caption && <figcaption className="glow-text mt-3 text-center text-xs font-medium">{caption}</figcaption>}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              data-cursor-label="Cerrar"
              className="press absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white backdrop-blur transition hover:border-nude/50"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.figure>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
