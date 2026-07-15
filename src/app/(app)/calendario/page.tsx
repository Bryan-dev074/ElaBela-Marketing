"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { SPECIAL_DATES, POST_TYPES } from "@/lib/data";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function CalendarioPage() {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startPad = (first.getDay() + 6) % 7;
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const specialByDate = useMemo(() => new Map(SPECIAL_DATES.map((s) => [s.date, s])), []);
  const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div>
      <PageHeader
        eyebrow="Programación"
        title="Calendario"
        description="Todo lo que hay que hacer, de un vistazo. Los feriados y fechas especiales de Paraguay disparan posts tipo «Especial»."
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 }))} className="rounded-lg border border-white/10 p-2 text-[var(--muted)] transition hover:text-white" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[9rem] text-center text-sm font-medium text-white">{MESES[cursor.m]} {cursor.y}</span>
            <button onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 }))} className="rounded-lg border border-white/10 p-2 text-[var(--muted)] transition hover:text-white" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card className="p-4 sm:p-6" hover={false}>
          <div className="mb-2 grid grid-cols-7 gap-2">
            {DIAS.map((d) => <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {grid.map((d, i) => {
              if (d === null) return <div key={i} />;
              const dateIso = iso(cursor.y, cursor.m, d);
              const special = specialByDate.get(dateIso);
              const isToday = dateIso === todayIso;
              const post = POST_TYPES[(d - 1) % POST_TYPES.length];
              return (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2, delay: i * 0.003 }}
                  className={`relative aspect-square rounded-xl border p-2 text-left transition ${isToday ? "border-nude/60 bg-nude/10" : "border-white/8 bg-white/[0.02] hover:border-white/20"}`}>
                  <span className={`text-xs ${isToday ? "font-bold text-white" : "text-[var(--faint)]"}`}>{d}</span>
                  {special ? (
                    <div className="mt-1 flex flex-col gap-0.5">
                      <span className="text-base leading-none">{special.emoji}</span>
                      <span className="line-clamp-1 text-[9px] text-nude">{special.label}</span>
                    </div>
                  ) : (
                    <span className="absolute bottom-1.5 left-2 h-1.5 w-1.5 rounded-full" style={{ background: post.accent }} title={`Post sugerido: ${post.name}`} />
                  )}
                </motion.div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6" hover={false}>
          <h2 className="mb-4 text-lg font-semibold text-white">Rotación de contenido</h2>
          <ul className="space-y-2.5">
            {POST_TYPES.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base" style={{ background: `${p.accent}22` }}>{p.icon}</span>
                <div>
                  <p className="text-sm text-white">{p.name}</p>
                  <p className="text-[11px] text-[var(--faint)]">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="divider my-5" />
          <p className="text-xs text-[var(--muted)]">Integrable con Gemini API para detectar fechas relevantes y generar arte alusivo automáticamente.</p>
        </Card>
      </div>
    </div>
  );
}
