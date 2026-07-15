"use client";

import { useState } from "react";
import { Plus, Copy, Check } from "lucide-react";
import { PageHeader, Card, Reveal } from "@/components/ui";
import { BRAND_COLORS } from "@/lib/brand";

interface Swatch { name: string; role: string; hex: string; }
interface Font { name: string; family: string; }

export default function MarcaPage() {
  const [colors, setColors] = useState<Swatch[]>(BRAND_COLORS.map((c) => ({ ...c })));
  const [fonts, setFonts] = useState<Font[]>([
    { name: "Fraunces (Display)", family: "var(--font-display)" },
    { name: "Inter (Texto)", family: "var(--font-sans)" },
  ]);
  const [copied, setCopied] = useState<string | null>(null);
  const [newColor, setNewColor] = useState({ name: "", hex: "#c18468" });
  const [newFont, setNewFont] = useState("");

  function addColor() {
    if (!newColor.name.trim()) return;
    setColors((c) => [...c, { name: newColor.name.trim(), role: "Nuevo", hex: newColor.hex }]);
    setNewColor({ name: "", hex: "#c18468" });
  }
  function addFont() {
    if (!newFont.trim()) return;
    setFonts((f) => [...f, { name: newFont.trim(), family: `'${newFont.trim()}', var(--font-sans)` }]);
    setNewFont("");
  }
  function copyHex(hex: string) {
    navigator.clipboard?.writeText(hex).then(() => {
      setCopied(hex);
      setTimeout(() => setCopied(null), 1200);
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Identidad"
        title="Manual de Marca"
        description="Paleta y tipografías oficiales, siempre con ejemplo visual real. Cualquier perfil puede agregar colores o fuentes; la grilla crece sin límite."
      />

      {/* Colors */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg text-cream">Paleta</h2>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {colors.map((c, i) => (
          <Reveal key={c.name + i} delay={i * 0.03}>
            <Card className="overflow-hidden p-0">
              <div className="h-24 w-full" style={{ background: c.hex }} />
              <div className="p-4">
                <p className="text-sm font-semibold text-cream">{c.name}</p>
                <p className="text-[11px] text-[var(--muted)]">{c.role}</p>
                <button
                  onClick={() => copyHex(c.hex)}
                  className="mt-2 flex items-center gap-1.5 font-mono text-xs text-[var(--muted)] transition hover:text-cream"
                >
                  {copied === c.hex ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {c.hex}
                </button>
              </div>
            </Card>
          </Reveal>
        ))}
        {/* Add color card */}
        <Card className="flex flex-col justify-center gap-2 p-4" hover={false}>
          <input
            value={newColor.name}
            onChange={(e) => setNewColor((s) => ({ ...s, name: e.target.value }))}
            placeholder="Nombre del color"
            className="rounded-lg border border-[var(--border)] bg-black/20 px-2.5 py-1.5 text-xs text-[var(--text)] outline-none focus:border-terra/50"
          />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newColor.hex}
              onChange={(e) => setNewColor((s) => ({ ...s, hex: e.target.value }))}
              className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
              aria-label="Elegir color"
            />
            <button onClick={addColor} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-terra/20 py-1.5 text-xs text-cream transition hover:bg-terra/30">
              <Plus className="h-3 w-3" /> Agregar
            </button>
          </div>
        </Card>
      </div>

      {/* Fonts */}
      <h2 className="mb-4 text-lg text-cream">Tipografías</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {fonts.map((f, i) => (
          <Reveal key={f.name + i} delay={i * 0.04}>
            <Card className="p-6">
              <p className="mb-2 text-xs text-[var(--muted)]">{f.name}</p>
              <p className="text-3xl text-cream" style={{ fontFamily: f.family }}>
                Aa Bb Cc 123
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]" style={{ fontFamily: f.family }}>
                ElaBela — belleza que brilla
              </p>
            </Card>
          </Reveal>
        ))}
        <Card className="flex items-center gap-2 p-6" hover={false}>
          <input
            value={newFont}
            onChange={(e) => setNewFont(e.target.value)}
            placeholder="Nombre de la fuente (ej: Poppins)"
            className="flex-1 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-terra/50"
          />
          <button onClick={addFont} className="flex items-center gap-1 rounded-lg bg-terra/20 px-3 py-2 text-xs text-cream transition hover:bg-terra/30">
            <Plus className="h-3 w-3" /> Agregar
          </button>
        </Card>
      </div>
    </div>
  );
}
