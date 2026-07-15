import type { Guion } from "@/lib/data";

/**
 * Importa un guion creado en la app "Guion-ElaBela / Content Studio IA".
 * Acepta:
 *  - el JSON `ScriptResult` o el envelope `SavedScript` (localStorage / export JSON), o
 *  - el Markdown que exporta esa app (`guion-elabela-{lang}.md`).
 */

type Localized = { es?: string; pt?: string } | undefined;
const loc = (l: Localized) => (l?.es || l?.pt || "").trim();

interface Scene {
  label?: Localized; timecode?: string; roll?: string;
  audio?: Localized; visual?: Localized; acting?: Localized; sfx?: Localized;
}
interface ScriptResult {
  productionMode?: string;
  title?: Localized; summary?: Localized; hookStrategy?: Localized;
  scenes?: Scene[]; cta?: Localized;
}

function scriptToMarkdown(r: ScriptResult): string {
  let md = `# ${loc(r.title) || "Guion"}\n\n`;
  if (loc(r.summary)) md += `${loc(r.summary)}\n\n`;
  if (loc(r.hookStrategy)) md += `> **Gancho:** ${loc(r.hookStrategy)}\n\n`;
  md += `**Modo:** ${r.productionMode === "hibrido" ? "Híbrido (local + IA)" : "100% IA"}\n\n`;
  (r.scenes ?? []).forEach((s, i) => {
    md += `## ${i + 1}. ${loc(s.label) || "Escena"}${s.timecode ? ` · ${s.timecode}` : ""}${s.roll ? ` · ${s.roll}` : ""}\n\n`;
    if (loc(s.audio)) md += `**🎙️ Locución:** ${loc(s.audio)}\n\n`;
    if (loc(s.visual)) md += `**🎬 Visual:** ${loc(s.visual)}\n\n`;
    if (loc(s.acting)) md += `**🎭 Actuación:** ${loc(s.acting)}\n\n`;
    if (loc(s.sfx)) md += `**🔊 SFX:** ${loc(s.sfx)}\n\n`;
  });
  if (loc(r.cta)) md += `## 📣 CTA\n\n${loc(r.cta)}\n`;
  return md.trim();
}

export function parseGuionInput(text: string): Partial<Guion> | null {
  const t = text.trim();
  if (!t) return null;

  // 1) JSON (ScriptResult o SavedScript)
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    const data = ((j.data as ScriptResult) ?? (j as ScriptResult));
    if (data && (Array.isArray(data.scenes) || data.title)) {
      const brief = j.brief as { products?: { name?: string }[] } | undefined;
      return {
        name: loc(data.title) || (j.title as string) || "Guion importado",
        product: brief?.products?.[0]?.name || "—",
        brand: "ElaBela",
        body: scriptToMarkdown(data),
        types: [data.productionMode === "hibrido" ? "Video Híbrido" : "Video con IA"],
        state: "listo",
        record: "",
        publish: "",
      };
    }
  } catch {
    /* not JSON — fall through to markdown */
  }

  // 2) Markdown export
  const heading = t.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return {
    name: heading || t.split("\n")[0].slice(0, 60) || "Guion importado",
    product: "—",
    brand: "ElaBela",
    body: t,
    types: [],
    state: "listo",
    record: "",
    publish: "",
  };
}
