"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Settings2 } from "lucide-react";
import { Card } from "@/components/ui";
import { cursorIntentProps } from "@/lib/cursor-intent";
import { AvatarChip } from "@/components/Avatar";
import { storyDoneToday, type StoryPlatform } from "@/lib/data";

/**
 * Tarjeta de historias por plataforma: contador DIARIO (si `doneDate` no es
 * hoy arranca de 0), barra segmentada con marcador de mínimo y celebración
 * one-shot al llegar al máximo (chispas + anillo glow + pop del contador).
 */

const BURST_SPARKS = [
  { e: "✨", dx: -74, dy: -46, rot: -30, sc: 1.15 },
  { e: "💫", dx: 70, dy: -58, rot: 25, sc: 1.0 },
  { e: "🌟", dx: -34, dy: -80, rot: -15, sc: 0.9 },
  { e: "✨", dx: 42, dy: -86, rot: 40, sc: 1.2 },
  { e: "✨", dx: -94, dy: 8, rot: -50, sc: 0.85 },
  { e: "💫", dx: 96, dy: -2, rot: 35, sc: 1.05 },
  { e: "🌟", dx: -58, dy: 54, rot: -20, sc: 0.8 },
  { e: "✨", dx: 62, dy: 46, rot: 30, sc: 1.0 },
  { e: "✨", dx: 6, dy: -98, rot: 10, sc: 1.25 },
  { e: "💫", dx: -8, dy: 64, rot: -35, sc: 0.9 },
];

export function StoryCard({
  s,
  isAdmin,
  onCfg,
  onBump,
}: {
  s: StoryPlatform;
  isAdmin: boolean;
  onCfg: () => void;
  onBump: (d: number) => void;
}) {
  const done = storyDoneToday(s);
  const atMax = s.max > 0 && done >= s.max;
  const ok = done >= s.min;
  const [burst, setBurst] = useState(0);
  const prevDone = useRef(done);

  useEffect(() => {
    if (done >= s.max && prevDone.current < s.max) setBurst((b) => b + 1);
    prevDone.current = done;
  }, [done, s.max]);

  return (
    <Card className={`relative p-5 ${atMax ? "ring-glow" : "card-sheen"}`} hover={false}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{s.icon}</span>
          <h2 className="text-sm font-semibold text-white">Historias · {s.platform}</h2>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={onCfg}
            {...cursorIntentProps("edit", "Configurar")}
            className="press flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[var(--faint)] transition hover:border-white/25 hover:text-white"
            aria-label={`Configurar historias de ${s.platform}`}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Barra segmentada con marcador de mínimo */}
      <div className="mb-2 mt-6 flex items-center gap-1.5">
        {Array.from({ length: s.max }).map((_, j) => (
          <Fragment key={j}>
            <div
              className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                j < done
                  ? atMax
                    ? "glow-pulse bg-nude shadow-[0_0_14px_rgba(214,171,153,0.9)]"
                    : "bg-nude shadow-[0_0_10px_rgba(214,171,153,0.55)]"
                  : "bg-white/10"
              }`}
            />
            {j + 1 === s.min && s.min < s.max && (
              <span className="relative -mx-0.5 h-4 w-0.5 shrink-0 rounded-full bg-nude/50">
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-wider text-nude">
                  mín
                </span>
              </span>
            )}
          </Fragment>
        ))}
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <motion.span
          key={done}
          initial={{ scale: atMax ? 1.4 : 1.15 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 18 }}
          className={`num inline-block font-display text-2xl font-semibold ${atMax ? "glow-text" : "text-white"}`}
        >
          {done}
          <span className={`text-sm ${atMax ? "" : "text-[var(--faint)]"}`}>/{s.max}</span>
        </motion.span>
        {atMax ? (
          <span className="glow-text text-[11px] font-bold">¡Máximo alcanzado! 🎉</span>
        ) : (
          <span className={`text-[11px] font-medium ${ok ? "text-emerald-300" : "text-amber-300"}`}>
            {ok ? "Mínimo cumplido ✓" : `Faltan ${s.min - done} para el mínimo`}
          </span>
        )}
      </div>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => onBump(-1)}
          disabled={done <= 0}
          className="press flex-1 rounded-lg border border-white/10 py-1.5 text-sm text-[var(--muted)] transition hover:text-white disabled:opacity-40"
          aria-label={`Restar una historia de ${s.platform}`}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onBump(1)}
          disabled={atMax}
          className={`press flex-[2] rounded-lg py-1.5 text-sm transition ${
            atMax ? "bg-nude/15 font-semibold text-nude" : "bg-white/10 text-white hover:bg-white/15"
          } disabled:opacity-70`}
          {...cursorIntentProps("complete", atMax ? "¡Completo!" : "+1 historia")}
        >
          {atMax ? "¡Completo por hoy! ✨" : "+ Subir"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--faint)]">
        <Clock className="h-3 w-3" />
        {s.schedules.length > 0 ? (
          s.schedules.map((h) => (
            <span key={h} className="num rounded-full border border-white/10 bg-white/5 px-1.5 py-px">
              {h}
            </span>
          ))
        ) : (
          <span>Sin horarios</span>
        )}
        <span className="text-white/15">·</span>
        <AvatarChip username={s.assignee} size={16} />
      </div>

      {/* Chispas al llegar al máximo (one-shot) */}
      {burst > 0 && (
        <span key={burst} className="max-burst" aria-hidden>
          {BURST_SPARKS.map((sp, k) => (
            <span
              key={k}
              style={
                {
                  "--dx": `${sp.dx}px`,
                  "--dy": `${sp.dy}px`,
                  "--rot": `${sp.rot}deg`,
                  "--s": sp.sc,
                  fontSize: 13 + (k % 3) * 3,
                  animationDelay: `${(k % 5) * 45}ms`,
                } as React.CSSProperties
              }
            >
              {sp.e}
            </span>
          ))}
        </span>
      )}
    </Card>
  );
}
