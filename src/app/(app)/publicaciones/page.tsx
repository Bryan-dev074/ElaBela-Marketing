"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { PageHeader, Card, Reveal } from "@/components/ui";
import { POST_TYPES, WEEKLY_REQS } from "@/lib/data";

function status(progress: number) {
  if (progress >= 1) return { icon: <CheckCircle2 className="h-4 w-4" />, label: "Cumplido", cls: "text-emerald-300" };
  if (progress >= 0.6) return { icon: <AlertTriangle className="h-4 w-4" />, label: "Parcial", cls: "text-amber-300" };
  return { icon: <XCircle className="h-4 w-4" />, label: "No cumplido", cls: "text-red-300" };
}

export default function PublicacionesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Contenido"
        title="Publicaciones"
        description="El motor de programación decide qué tipo de post toca cada día para mantener un feed limpio y coherente en IG, TikTok y Facebook."
      />

      <h2 className="mb-4 text-lg text-cream">Tipos de post</h2>
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {POST_TYPES.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.05}>
            <Card className="group p-5">
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition group-hover:scale-110"
                style={{ background: `${p.accent}22`, boxShadow: `0 8px 30px -12px ${p.accent}` }}
              >
                {p.icon}
              </div>
              <h3 className="text-lg text-cream">{p.name}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{p.desc}</p>
            </Card>
          </Reveal>
        ))}
      </div>

      <h2 className="mb-4 text-lg text-cream">Cumplimiento semanal</h2>
      <Card className="overflow-hidden" hover={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                <th className="px-5 py-3 font-medium">Plataforma</th>
                <th className="px-5 py-3 font-medium">Formato</th>
                <th className="px-5 py-3 font-medium">Frecuencia</th>
                <th className="px-5 py-3 font-medium">Objetivo</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {WEEKLY_REQS.map((r, i) => {
                const s = status(r.progress);
                return (
                  <motion.tr
                    key={r.platform + r.format}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                    className="border-b border-[var(--border)]/60 last:border-0"
                  >
                    <td className="px-5 py-4 font-medium text-cream">{r.platform}</td>
                    <td className="px-5 py-4 text-[var(--text)]">{r.format}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{r.freq}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{r.goal}</td>
                    <td className={`px-5 py-4 ${s.cls}`}>
                      <span className="inline-flex items-center gap-1.5">{s.icon}{s.label}</span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
