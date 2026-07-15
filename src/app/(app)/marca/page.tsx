"use client";

import { useState } from "react";
import { Plus, Copy, Check } from "lucide-react";
import { PageHeader, Card, Reveal, Button, Field, Input } from "@/components/ui";
import { BRAND_COLORS } from "@/lib/brand";

interface Swatch { name: string; role: string; hex: string }
interface Font { name: string; family: string }

export default function MarcaPage() {
  const [colors, setColors] = useState<Swatch[]>(BRAND_COLORS.map((c) => ({ ...c })));
  const [fonts, setFonts] = useState<Font[]>([{ name: "Inter (UI)", family: "var(--font-sans)" }]);
  const [copied, setCopied] = useState<string | null>(null);
  const [newColor, setNewColor] = useState({ name: "", hex: "#d6ab99" });
  const [newFont, setNewFont] = useState("");

  const addColor = () => { if (newColor.name.trim()) { setColors((c) => [...c, { name: newColor.name.trim(), role: "Nuevo", hex: newColor.hex }]); setNewColor({ name: "", hex: "#d6ab99" }); } };
  const addFont = () => { if (newFont.trim()) { setFonts((f) => [...f, { name: newFont.trim(), family: `'${newFont.trim()}', var(--font-sans)` }]); setNewFont(""); } };
  const copyHex = (hex: string) => navigator.clipboard?.writeText(hex).then(() => { setCopied(hex); setTimeout(() => setCopied(null), 1200); });

  return (
    <div>
      <PageHeader eyebrow="Identidad" title="Manual de Marca" description="Paleta y tipografías oficiales de ElaBela, siempre con ejemplo visual real. Cualquier perfil puede agregar; la grilla crece sin límite." />

      <h2 className="mb-4 text-lg font-semibold text-white">Paleta</h2>
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {colors.map((c, i) => (
          <Reveal key={c.name + i} delay={i * 0.03}>
            <Card className="overflow-hidden p-0">
              <div className="h-24 w-full" style={{ background: c.hex }} />
              <div className="p-4">
                <p className="text-sm font-semibold text-white">{c.name}</p>
                <p className="text-[11px] text-[var(--faint)]">{c.role}</p>
                <button onClick={() => copyHex(c.hex)} className="mt-2 flex items-center gap-1.5 font-mono text-xs text-[var(--muted)] transition hover:text-white">
                  {copied === c.hex ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}{c.hex}
                </button>
              </div>
            </Card>
          </Reveal>
        ))}
        <Card className="flex flex-col justify-center gap-2 p-4" hover={false}>
          <Input value={newColor.name} onChange={(e) => setNewColor((s) => ({ ...s, name: e.target.value }))} placeholder="Nombre del color" />
          <div className="flex items-center gap-2">
            <input type="color" value={newColor.hex} onChange={(e) => setNewColor((s) => ({ ...s, hex: e.target.value }))} className="h-9 w-11 cursor-pointer rounded border border-white/10 bg-transparent" aria-label="Elegir color" />
            <Button variant="subtle" className="flex-1" onClick={addColor}><Plus className="h-3.5 w-3.5" /> Agregar</Button>
          </div>
        </Card>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-white">Tipografías</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {fonts.map((f, i) => (
          <Reveal key={f.name + i} delay={i * 0.04}>
            <Card className="p-6">
              <p className="mb-2 text-xs text-[var(--muted)]">{f.name}</p>
              <p className="text-3xl text-white" style={{ fontFamily: f.family }}>Aa Bb Cc 123</p>
              <p className="mt-1 text-sm text-[var(--muted)]" style={{ fontFamily: f.family }}>ElaBela — belleza que brilla</p>
            </Card>
          </Reveal>
        ))}
        <Card className="flex items-center gap-2 p-6" hover={false}>
          <div className="flex-1"><Field><Input value={newFont} onChange={(e) => setNewFont(e.target.value)} placeholder="Nombre de la fuente (ej: Poppins)" /></Field></div>
          <Button variant="subtle" onClick={addFont}><Plus className="h-3.5 w-3.5" /> Agregar</Button>
        </Card>
      </div>
    </div>
  );
}
