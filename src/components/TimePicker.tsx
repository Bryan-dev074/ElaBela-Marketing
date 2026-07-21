"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus, X, Check } from "lucide-react";
import { useDialogPortalTarget } from "@/components/dialog-portal";
import { cursorIntentProps } from "@/lib/cursor-intent";

/**
 * Interactive time picker: a floating "clock" panel with hour/minute wheels
 * and quick presets. `TimeListEditor` manages a list of schedule chips
 * (used for story schedules) backed by the picker.
 */

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const PRESETS = ["09:00", "12:00", "13:00", "17:00", "18:00", "20:00"];

function parse(v?: string): { h: string; m: string } {
  const m = v?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { h: "09", m: "00" };
  return { h: m[1].padStart(2, "0"), m: m[2] };
}

function Wheel({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>(`[data-v="${value}"]`);
    el?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className="no-scrollbar h-40 flex-1 snap-y snap-mandatory overflow-y-auto rounded-xl border border-[var(--border)] bg-black/30 py-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          data-v={o}
          onClick={() => onPick(o)}
          className={`num block w-full snap-center py-1.5 text-center text-sm transition ${
            o === value ? "bg-nude/20 font-semibold text-white" : "text-[var(--muted)] hover:bg-white/5 hover:text-white"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function TimePickerPanel({
  value,
  onConfirm,
  onClose,
  anchor,
}: {
  value?: string;
  onConfirm: (v: string) => void;
  onClose: () => void;
  anchor: DOMRect | null;
}) {
  const [{ h, m }, set] = useState(parse(value));
  const portalTarget = useDialogPortalTarget();

  useEffect(() => {
    // Capture + preventDefault so Escape closes ONLY the popover, not a parent Modal.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose]);

  const panelW = 264, panelH = 320;
  const top = anchor
    ? anchor.bottom + panelH + 12 > window.innerHeight && anchor.top - panelH - 12 > 0
      ? anchor.top - panelH - 8
      : anchor.bottom + 8
    : window.innerHeight / 2 - panelH / 2;
  const left = anchor ? Math.min(Math.max(8, anchor.left), window.innerWidth - panelW - 8) : window.innerWidth / 2 - panelW / 2;

  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      <div key="time-picker-backdrop" className="fixed inset-0 z-[140]" onClick={onClose} />
      <motion.div
        key="time-picker-panel"
        initial={{ opacity: 0, scale: 0.95, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="popover-panel fixed z-[150] w-[264px] rounded-2xl p-4"
        style={{ top, left }}
      >
        <div className="mb-3 flex items-center justify-center gap-1">
          <Clock className="mr-1 h-4 w-4 text-nude" />
          <span className="num font-display text-3xl font-semibold text-white">{h}</span>
          <span className="glow-text font-display text-3xl font-semibold">:</span>
          <span className="num font-display text-3xl font-semibold text-white">{m}</span>
        </div>
        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <p className="eyebrow mb-1 text-center !text-[9px]">Hora</p>
            <Wheel options={HOURS} value={h} onPick={(v) => set((s) => ({ ...s, h: v }))} />
          </div>
          <div className="flex-1">
            <p className="eyebrow mb-1 text-center !text-[9px]">Min</p>
            <Wheel options={MINUTES} value={m} onPick={(v) => set((s) => ({ ...s, m: v }))} />
          </div>
        </div>
        <div className="mb-3 flex flex-wrap justify-center gap-1.5">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => set(parse(p))} className={`num press rounded-full border px-2 py-0.5 text-[10px] transition ${`${h}:${m}` === p ? "border-nude/60 bg-nude/15 text-nude" : "border-white/10 text-[var(--faint)] hover:text-white"}`}>
              {p}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { onConfirm(`${h}:${m}`); onClose(); }}
          className="press flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          <Check className="h-4 w-4" /> Confirmar
        </button>
      </motion.div>
    </AnimatePresence>,
    portalTarget,
  );
}

/** A single time value with a clock trigger. */
export function TimePicker({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const closePanel = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setAnchor(btnRef.current?.getBoundingClientRect() ?? null); setOpen(true); }}
        className={`field num flex items-center justify-between gap-2 text-left ${className}`}
        {...cursorIntentProps("open", "Elegir hora")}
      >
        <span>{value || "— : —"}</span>
        <Clock className="h-3.5 w-3.5 text-nude" />
      </button>
      {open && <TimePickerPanel value={value} onConfirm={onChange} onClose={closePanel} anchor={anchor} />}
    </>
  );
}

/** Chip list of schedules with add/remove, backed by the interactive picker. */
export function TimeListEditor({ times, onChange }: { times: string[]; onChange: (t: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const closePanel = useCallback(() => {
    setOpen(false);
    addRef.current?.focus();
  }, []);

  const add = (v: string) => {
    if (!times.includes(v)) onChange([...times, v].sort());
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <AnimatePresence initial={false}>
        {times.map((t) => (
          <motion.span
            key={t}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className="num inline-flex items-center gap-1 rounded-full border border-nude/30 bg-nude/10 py-1 pl-2.5 pr-1 text-xs text-nude"
          >
            {t}
            <button type="button" onClick={() => onChange(times.filter((x) => x !== t))} className="rounded-full p-0.5 text-nude/60 transition hover:bg-nude/20 hover:text-white" aria-label={`Quitar ${t}`}>
              <X className="h-3 w-3" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <button
        ref={addRef}
        type="button"
        onClick={() => { setAnchor(addRef.current?.getBoundingClientRect() ?? null); setOpen(true); }}
        className="press inline-flex items-center gap-1 rounded-full border border-dashed border-white/20 px-2.5 py-1 text-xs text-[var(--muted)] transition hover:border-nude/50 hover:text-white"
        {...cursorIntentProps("open", "Agregar horario")}
      >
        <Plus className="h-3 w-3" /> Horario
      </button>
      {open && <TimePickerPanel onConfirm={add} onClose={closePanel} anchor={anchor} />}
    </div>
  );
}
