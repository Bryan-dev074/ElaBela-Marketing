"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check, Plus } from "lucide-react";
import { PageHeader, Card, Reveal } from "@/components/ui";
import { TOOL_CATEGORIES } from "@/lib/data";

export default function ToolsPage() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, id: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1400);
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Recursos del equipo"
        title="Tools"
        description="Prompts, GEMS, apps, IA, ads y enlaces oficiales. Cualquier perfil puede sugerir un recurso nuevo."
        action={
          <button className="flex items-center gap-2 rounded-2xl border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted)] transition hover:border-terra/50 hover:text-cream">
            <Plus className="h-4 w-4" /> Sugerir herramienta
          </button>
        }
      />

      <div className="grid gap-5 md:grid-cols-2">
        {TOOL_CATEGORIES.map((cat, i) => (
          <Reveal key={cat.id} delay={i * 0.05}>
            <Card className="flex h-full flex-col p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/25 text-xl">{cat.emoji}</span>
                <div>
                  <h3 className="text-lg text-cream">{cat.title}</h3>
                  <p className="text-xs text-[var(--muted)]">{cat.desc}</p>
                </div>
              </div>
              <ul className="mt-auto space-y-2">
                {cat.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-black/15 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--text)]">{item.label}</p>
                      {item.note && <p className="truncate text-[11px] text-[var(--muted)]">{item.note}</p>}
                    </div>
                    {item.href ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)] transition hover:border-terra/50 hover:text-cream"
                        aria-label={`Abrir ${item.label}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <button
                        onClick={() => copy(item.note || item.label, cat.id + item.label)}
                        className="shrink-0 rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)] transition hover:border-terra/50 hover:text-cream"
                        aria-label="Copiar"
                      >
                        {copied === cat.id + item.label ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
