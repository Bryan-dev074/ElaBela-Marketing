"use client";

import { useMemo, useState } from "react";
import { Instagram, Music2, Facebook, MessageCircle, ShoppingBag, Bell, Search, Plus } from "lucide-react";
import { PageHeader, Card, Reveal, Button, Modal, Field, Input, Select } from "@/components/ui";
import { CLIENTS, PRODUCTS, type Client, type Product } from "@/lib/data";

const CHANNELS: Client["main"][] = ["Instagram", "TikTok", "Facebook", "WhatsApp"];
const CHANNEL_ICON: Record<Client["main"], React.ReactNode> = {
  Instagram: <Instagram className="h-4 w-4" />,
  TikTok: <Music2 className="h-4 w-4" />,
  Facebook: <Facebook className="h-4 w-4" />,
  WhatsApp: <MessageCircle className="h-4 w-4" />,
};

export default function HubPage() {
  const [tab, setTab] = useState<"clientes" | "productos">("clientes");
  const [clients, setClients] = useState<Client[]>(CLIENTS);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);

  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<"all" | Client["main"]>("all");
  const [bought, setBought] = useState<"all" | "yes" | "no">("all");

  const [addClient, setAddClient] = useState(false);
  const [addProduct, setAddProduct] = useState(false);
  const [nc, setNc] = useState({ name: "", whatsapp: "", main: "Instagram" as Client["main"], bought: "no" });
  const [np, setNp] = useState({ code: "", name: "", brand: "", category: "", durationDays: "30" });

  const filtered = useMemo(
    () =>
      clients.filter((c) => {
        if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
        if (channel !== "all" && c.main !== channel) return false;
        if (bought === "yes" && !c.bought) return false;
        if (bought === "no" && c.bought) return false;
        return true;
      }),
    [clients, q, channel, bought],
  );

  const prodFiltered = useMemo(
    () => products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.brand.toLowerCase().includes(q.toLowerCase())),
    [products, q],
  );

  function createClient() {
    if (!nc.name.trim()) return;
    setClients((prev) => [{ id: "c" + Date.now(), name: nc.name.trim(), whatsapp: nc.whatsapp, main: nc.main, bought: nc.bought === "yes" }, ...prev]);
    setNc({ name: "", whatsapp: "", main: "Instagram", bought: "no" });
    setAddClient(false);
  }
  function createProduct() {
    if (!np.code.trim() || !np.name.trim()) return;
    setProducts((prev) => [{ code: np.code.trim(), name: np.name.trim(), brand: np.brand, category: np.category, durationDays: Number(np.durationDays) || 30 }, ...prev]);
    setNp({ code: "", name: "", brand: "", category: "", durationDays: "30" });
    setAddProduct(false);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Datos comerciales"
        title="HUB Clientes / Productos"
        description="La duración de cada producto calcula cuándo volver a contactar al cliente y alimenta la tarea «Nutrición de Leads»."
        action={<Button onClick={() => (tab === "clientes" ? setAddClient(true) : setAddProduct(true))}><Plus className="h-4 w-4" /> {tab === "clientes" ? "Nuevo cliente" : "Nuevo producto"}</Button>}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
          {(["clientes", "productos"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-5 py-2 text-sm font-medium capitalize transition ${tab === t ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"}`}>{t}</button>
          ))}
        </div>
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="field pl-9" />
        </div>
        {tab === "clientes" && (
          <>
            <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className="field w-auto" style={{ background: "#121216" }}>
              <option value="all">Todos los canales</option>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={bought} onChange={(e) => setBought(e.target.value as typeof bought)} className="field w-auto" style={{ background: "#121216" }}>
              <option value="all">Compra: todos</option>
              <option value="yes">Compró</option>
              <option value="no">Sin compra</option>
            </select>
          </>
        )}
      </div>

      {tab === "clientes" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.04}>
              <Card className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">{c.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]"><span className="text-nude">{CHANNEL_ICON[c.main]}</span> {c.main} · {c.whatsapp}</p>
                  </div>
                  {c.bought ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-300"><ShoppingBag className="h-3 w-3" /> Compró</span>
                  ) : (
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[var(--faint)]">Sin compra</span>
                  )}
                </div>
                {c.bought ? (
                  <div className="mt-4 rounded-xl border border-white/8 bg-black/20 p-3 text-xs">
                    {c.lastPurchase && <p className="text-[var(--muted)]">Última compra: <span className="text-white">{new Date(c.lastPurchase + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "short" })}</span></p>}
                    {c.nextContact && <p className="mt-1 flex items-center gap-1.5 text-nude"><Bell className="h-3 w-3" /> Próximo contacto: {new Date(c.nextContact + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "short" })}</p>}
                  </div>
                ) : (
                  <button className="mt-4 w-full rounded-lg border border-nude/40 bg-nude/10 py-2 text-xs font-medium text-white transition hover:bg-nude/20">Programar mensaje de interacción →</button>
                )}
              </Card>
            </Reveal>
          ))}
          {filtered.length === 0 && <p className="col-span-full py-12 text-center text-sm text-[var(--muted)]">Sin clientes que coincidan.</p>}
        </div>
      ) : (
        <Card className="overflow-hidden" hover={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/8 text-[var(--muted)]">
                  <th className="px-5 py-3 font-medium">Código</th><th className="px-5 py-3 font-medium">Producto</th>
                  <th className="px-5 py-3 font-medium">Marca</th><th className="px-5 py-3 font-medium">Categoría</th><th className="px-5 py-3 font-medium">Duración</th>
                </tr>
              </thead>
              <tbody>
                {prodFiltered.map((p) => (
                  <tr key={p.code} className="border-b border-white/6 last:border-0 hover:bg-white/5">
                    <td className="px-5 py-4 font-mono text-xs text-[var(--faint)]">{p.code}</td>
                    <td className="px-5 py-4 font-medium text-white">{p.name}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-nude/10 px-2 py-0.5 text-xs text-nude">{p.brand}</span></td>
                    <td className="px-5 py-4 text-[var(--muted)]">{p.category}</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{p.durationDays} días</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={addClient} onClose={() => setAddClient(false)} title="Nuevo cliente"
        footer={<><Button variant="ghost" onClick={() => setAddClient(false)}>Cancelar</Button><Button onClick={createClient}>Agregar</Button></>}>
        <div className="space-y-4">
          <Field label="Nombre"><Input value={nc.name} onChange={(e) => setNc((s) => ({ ...s, name: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="WhatsApp"><Input value={nc.whatsapp} onChange={(e) => setNc((s) => ({ ...s, whatsapp: e.target.value }))} placeholder="09xx xxx xxx" /></Field>
            <Field label="Canal principal">
              <Select value={nc.main} onChange={(e) => setNc((s) => ({ ...s, main: e.target.value as Client["main"] }))}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</Select>
            </Field>
          </div>
          <Field label="¿Compró producto?">
            <Select value={nc.bought} onChange={(e) => setNc((s) => ({ ...s, bought: e.target.value }))}><option value="no">No</option><option value="yes">Sí</option></Select>
          </Field>
        </div>
      </Modal>

      <Modal open={addProduct} onClose={() => setAddProduct(false)} title="Nuevo producto"
        footer={<><Button variant="ghost" onClick={() => setAddProduct(false)}>Cancelar</Button><Button onClick={createProduct}>Agregar</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código"><Input value={np.code} onChange={(e) => setNp((s) => ({ ...s, code: e.target.value }))} placeholder="EL-010" /></Field>
            <Field label="Duración (días)"><Input type="number" value={np.durationDays} onChange={(e) => setNp((s) => ({ ...s, durationDays: e.target.value }))} /></Field>
          </div>
          <Field label="Nombre"><Input value={np.name} onChange={(e) => setNp((s) => ({ ...s, name: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marca"><Input value={np.brand} onChange={(e) => setNp((s) => ({ ...s, brand: e.target.value }))} /></Field>
            <Field label="Categoría"><Input value={np.category} onChange={(e) => setNp((s) => ({ ...s, category: e.target.value }))} /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
