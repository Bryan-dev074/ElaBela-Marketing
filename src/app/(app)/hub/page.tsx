"use client";

import { useState } from "react";
import { Instagram, Music2, Facebook, MessageCircle, ShoppingBag, Bell } from "lucide-react";
import { PageHeader, Card, Reveal } from "@/components/ui";
import { CLIENTS, PRODUCTS, type Client } from "@/lib/data";

const CHANNEL_ICON: Record<Client["main"], React.ReactNode> = {
  Instagram: <Instagram className="h-4 w-4" />,
  TikTok: <Music2 className="h-4 w-4" />,
  Facebook: <Facebook className="h-4 w-4" />,
  WhatsApp: <MessageCircle className="h-4 w-4" />,
};

export default function HubPage() {
  const [tab, setTab] = useState<"clientes" | "productos">("clientes");

  return (
    <div>
      <PageHeader
        eyebrow="Datos comerciales"
        title="HUB Clientes / Productos"
        description="La duración de cada producto calcula automáticamente cuándo volver a contactar al cliente y alimenta la tarea «Nutrición de Leads»."
      />

      <div className="mb-6 inline-flex rounded-2xl border border-[var(--border)] bg-black/20 p-1">
        {(["clientes", "productos"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-5 py-2 text-sm font-medium capitalize transition ${
              tab === t ? "bg-gradient-to-r from-terra to-chocolate text-cream" : "text-[var(--muted)] hover:text-cream"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "clientes" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {CLIENTS.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.05}>
              <Card className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-cream">{c.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                      <span className="text-terra">{CHANNEL_ICON[c.main]}</span> {c.main} · {c.whatsapp}
                    </p>
                  </div>
                  {c.bought ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-300">
                      <ShoppingBag className="h-3 w-3" /> Compró
                    </span>
                  ) : (
                    <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--muted)]">
                      Sin compra
                    </span>
                  )}
                </div>

                {c.bought ? (
                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-black/15 p-3 text-xs">
                    <p className="text-[var(--muted)]">
                      Última compra:{" "}
                      <span className="text-[var(--text)]">
                        {new Date(c.lastPurchase! + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "short" })}
                      </span>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-terra">
                      <Bell className="h-3 w-3" /> Próximo contacto:{" "}
                      {new Date(c.nextContact! + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                ) : (
                  <button className="mt-4 w-full rounded-xl border border-terra/40 bg-terra/10 py-2 text-xs font-medium text-cream transition hover:bg-terra/20">
                    Programar mensaje de interacción →
                  </button>
                )}
              </Card>
            </Reveal>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden" hover={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="px-5 py-3 font-medium">Código</th>
                  <th className="px-5 py-3 font-medium">Producto</th>
                  <th className="px-5 py-3 font-medium">Marca</th>
                  <th className="px-5 py-3 font-medium">Categoría</th>
                  <th className="px-5 py-3 font-medium">Duración</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCTS.map((p) => (
                  <tr key={p.code} className="border-b border-[var(--border)]/60 last:border-0 hover:bg-white/5">
                    <td className="px-5 py-4 font-mono text-xs text-[var(--muted)]">{p.code}</td>
                    <td className="px-5 py-4 font-medium text-cream">{p.name}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-nude/10 px-2 py-0.5 text-xs text-nude">{p.brand}</span></td>
                    <td className="px-5 py-4 text-[var(--text)]">{p.category}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{p.durationDays} días</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
