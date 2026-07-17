import type { Guion } from "@/lib/data";

/**
 * Importa un guion creado en la app "Guion-ElaBela / Content Studio IA".
 * Acepta:
 *  - el JSON `ScriptResult` o el envelope `SavedScript` (localStorage / export JSON), o
 *  - el Markdown que exporta esa app (`guion-elabela-{lang}.md`).
 *
 * El markdown generado acá replica EXACTAMENTE la estructura del export de esa
 * app (src/lib/export.ts) para que ambos caminos rendericen igual de premium.
 */

type Localized = { es?: string; pt?: string } | undefined;
const loc = (l: Localized) => (l?.es || l?.pt || "").trim();

interface Prompt {
  title?: Localized;
  model?: string;
  purpose?: Localized;
  flowInputs?: Localized;
  timecode?: string;
  content?: Localized;
}
interface Scene {
  label?: Localized; timecode?: string; roll?: string;
  audio?: Localized; visual?: Localized; acting?: Localized; sfx?: Localized;
  prompts?: Prompt[];
}
interface ScriptResult {
  productionMode?: string;
  title?: Localized; summary?: Localized; hookStrategy?: Localized;
  scenes?: Scene[]; cta?: Localized;
}

// ── Helpers de formato Markdown (GFM) ────────────────────────

/** Sanitiza texto para una celda de tabla GFM: escapa pipes y convierte saltos de línea. */
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

/** Colapsa saltos de línea en un espacio (títulos y líneas que deben ser únicas). */
const inline = (s: string) => s.replace(/\s*\r?\n\s*/g, " ").trim();

/** Prefija cada línea con "> " para blockquotes multilinea. */
const quote = (s: string) =>
  s
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");

/** Extrae el final del timecode de una escena ("33s – 39s" → "39s"). */
const endOfTimecode = (tc?: string): string | null => {
  const m = tc?.match(/\d+(?:[.,]\d+)?\s*s/gi);
  return m?.length ? m[m.length - 1].replace(/\s+/g, "") : null;
};

/** Badge visual del rollo de la toma (tolerante a variantes: "a-roll", "A Roll", "broll"…). */
const rollBadge = (roll?: string) => {
  const raw = roll?.trim();
  if (!raw) return "";
  const norm = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (norm.endsWith("aroll")) return " · 🅰️ A-Roll";
  if (norm.endsWith("broll")) return " · 🅱️ B-Roll";
  return ` · ${raw}`;
};

function scriptToMarkdown(r: ScriptResult): string {
  const scenes = r.scenes ?? [];
  const hibrido = r.productionMode === "hibrido";
  const out: string[] = [];

  // ── Cabecera ────────────────────────────────────────────────
  out.push(`# 🎬 ${inline(loc(r.title)) || "Guion"}`);
  out.push("");
  if (loc(r.summary)) {
    out.push(quote(`✨ ${loc(r.summary)}`));
    out.push("");
  }

  // Ficha rápida
  out.push("| | |");
  out.push("| --- | --- |");
  out.push(`| ⚙️ **Modo** | ${hibrido ? "Híbrido (Local + IA)" : "100% IA"} |`);
  if (loc(r.hookStrategy)) out.push(`| 🎯 **Gancho** | ${cell(loc(r.hookStrategy))} |`);
  out.push(`| 🎞️ **Escenas** | ${scenes.length} |`);
  const dur = endOfTimecode(scenes[scenes.length - 1]?.timecode);
  if (dur) out.push(`| ⏱️ **Duración** | ${dur} |`);
  out.push("");
  out.push("---");
  out.push("");

  // ── Locución ────────────────────────────────────────────────
  out.push("## 🎙️ Locución");
  out.push("");
  out.push(hibrido ? "_Para grabar por el presentador (A-Roll)_" : "_Lista para pegar en ElevenLabs_");
  out.push("");
  scenes.forEach((s) => {
    out.push(quote(`**⏱ [${inline(s.timecode ?? "")}] · ${inline(loc(s.label)) || "Escena"}**\n«${loc(s.audio)}»`));
    out.push("");
  });

  if (!hibrido) {
    out.push("**📋 Texto corrido para ElevenLabs:**");
    out.push("");
    out.push("```");
    out.push(scenes.map((s) => loc(s.audio)).join("\n\n"));
    out.push("```");
    out.push("");
  }

  // ── Guion escena por escena ─────────────────────────────────
  out.push("---");
  out.push("");
  out.push("## 🎬 Guion escena por escena");
  out.push("");

  scenes.forEach((s, i) => {
    out.push(
      `### ${i + 1} · ${inline(loc(s.label)) || "Escena"} — ⏱ [${inline(s.timecode ?? "")}]${rollBadge(s.roll)}`,
    );
    out.push("");
    out.push("| | |");
    out.push("| --- | --- |");
    out.push(`| 🎙️ **Locución** | ${cell(loc(s.audio))} |`);
    out.push(`| 🎥 **Visual** | ${cell(loc(s.visual))} |`);
    if (loc(s.acting)) out.push(`| 🎭 **Actuación** | ${cell(loc(s.acting))} |`);
    if (loc(s.sfx)) out.push(`| 🔊 **SFX** | ${cell(loc(s.sfx))} |`);
    out.push("");

    if (s.prompts?.length) {
      out.push("**🧩 Prompts de generación:**");
      out.push("");
      for (const p of s.prompts) {
        out.push(
          `**${p.timecode ? `[${inline(p.timecode)}] ` : ""}${inline(loc(p.title))}${p.model ? ` — ${p.model}` : ""}**`,
        );
        if (loc(p.purpose)) out.push(`- 🎯 Genera: ${inline(loc(p.purpose))}`);
        if (loc(p.flowInputs)) out.push(`- 📎 Cargar en Flow: ${inline(loc(p.flowInputs))}`);
        out.push("");
        out.push("```");
        out.push(loc(p.content));
        out.push("```");
        out.push("");
      }
    }
  });

  // ── CTA ─────────────────────────────────────────────────────
  out.push("---");
  out.push("");
  if (loc(r.cta)) {
    out.push("## 📣 CTA");
    out.push("");
    out.push(quote(`«${loc(r.cta)}»`));
    out.push("");
    out.push("---");
    out.push("");
  }

  out.push("_✨ Generado con Content Studio IA · ElaBela_");

  return out.join("\n");
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
    name: heading?.replace(/^🎬\s*/, "") || t.split("\n")[0].slice(0, 60) || "Guion importado",
    product: "—",
    brand: "ElaBela",
    body: t,
    types: [],
    state: "listo",
    record: "",
    publish: "",
  };
}
