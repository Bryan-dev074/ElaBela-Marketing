"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Film, Link2, CalendarClock, Sparkles } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { GUIONES, type Guion } from "@/lib/data";

const COLUMNS: { key: Guion["state"]; label: string; accent: string }[] = [
  { key: "falta", label: "Falta grabar", accent: "#8b6357" },
  { key: "editando", label: "Editando", accent: "#3b82f6" },
  { key: "listo", label: "Listo", accent: "#10b981" },
];

export default function GuionesPage() {
  const [guiones, setGuiones] = useState<Guion[]>(GUIONES);

  function advance(id: string) {
    setGuiones((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const order: Guion["state"][] = ["falta", "editando", "listo"];
        const next = order[(order.indexOf(g.state) + 1) % order.length];
        return { ...g, state: next };
      }),
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Producción de video"
        title="Guiones"
        description="Planificá y seguí cada guion: qué se graba, qué producto promociona, quién edita y cuándo se publica. Conectado al HUB de productos y al calendario."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const cards = guiones.filter((g) => g.state === col.key);
          return (
            <div key={col.key}>
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-cream">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.accent }} />
                  {col.label}
                </span>
                <span className="text-xs text-[var(--muted)]">{cards.length}</span>
              </div>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {cards.map((g) => (
                    <motion.div
                      key={g.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 260, damping: 26 }}
                    >
                      <Card className="p-4">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-cream">
                            <Film className="h-4 w-4 text-terra" /> {g.name}
                          </h3>
                          {g.state === "listo" && <Sparkles className="h-4 w-4 text-emerald-400" />}
                        </div>
                        <p className="mb-2 text-xs text-[var(--muted)]">
                          {g.product} · <span className="text-nude">{g.brand}</span>
                        </p>
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {g.types.map((t) => (
                            <span key={t} className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                          <span className="flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {new Date(g.publish + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "short" })}
                          </span>
                          <span className="capitalize">@{g.responsible}</span>
                        </div>
                        <button
                          onClick={() => advance(g.id)}
                          className="mt-3 w-full rounded-xl border border-[var(--border)] py-1.5 text-[11px] text-[var(--muted)] transition hover:border-terra/50 hover:text-cream"
                        >
                          Avanzar estado →
                        </button>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {cards.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] py-8 text-center text-xs text-[var(--muted)]">
                    Sin guiones
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Card className="mt-8 flex items-center gap-3 p-5" hover={false}>
        <Link2 className="h-5 w-5 text-terra" />
        <p className="text-sm text-[var(--muted)]">
          Acceso directo:{" "}
          <a href="https://content-studio-ia.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-nude underline-offset-2 hover:underline">
            Content Studio IA
          </a>{" "}
          — automatización y control estético de marca. <span className="text-emerald-400">🟢 Producción</span>
        </p>
      </Card>
    </div>
  );
}
