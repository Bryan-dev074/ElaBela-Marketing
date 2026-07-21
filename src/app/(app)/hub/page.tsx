"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Instagram, Music2, Facebook, MessageCircle, ShoppingBag, Bell, Search, Plus,
  Pencil, Trash2, Users, UserPlus, CalendarClock, Package, LayoutGrid, List,
} from "lucide-react";
import {
  PageHeader, Card, Reveal, StatCard, Segmented, EmptyState, Button, Modal, Field, Input, Select,
} from "@/components/ui";
import { cursorIntentProps } from "@/lib/cursor-intent";
import { fmtShortDate, type Client, type Product } from "@/lib/data";
import { useClients, useProducts } from "@/lib/db";

/* ---------------- Canales ---------------- */

const CHANNELS: Client["main"][] = ["Instagram", "TikTok", "Facebook", "WhatsApp"];
const CHANNEL_META: Record<Client["main"], { icon: React.ReactNode; chip: string }> = {
  Instagram: { icon: <Instagram className="h-3 w-3" />, chip: "border-pink-400/25 bg-pink-500/10 text-pink-300" },
  TikTok: { icon: <Music2 className="h-3 w-3" />, chip: "border-white/15 bg-white/10 text-zinc-200" },
  Facebook: { icon: <Facebook className="h-3 w-3" />, chip: "border-blue-400/25 bg-blue-500/10 text-blue-300" },
  WhatsApp: { icon: <MessageCircle className="h-3 w-3" />, chip: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" },
};

/* ---------------- Helpers ---------------- */

/** Normaliza un número paraguayo a enlace wa.me: saca todo lo que no es dígito, el 0 inicial, y prefija 595. */
function waHref(whatsapp: string) {
  let d = whatsapp.replace(/\D/g, "");
  if (!d) return null;
  if (!d.startsWith("595")) d = "595" + d.replace(/^0+/, "");
  return `https://wa.me/${d}`;
}

function daysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr + "T00:00:00").getTime() - today.getTime()) / 86400000);
}

function contactLabel(du: number) {
  if (du < -1) return `vencido hace ${-du} días`;
  if (du === -1) return "vencido ayer";
  if (du === 0) return "hoy";
  if (du === 1) return "mañana";
  return `en ${du} días`;
}

const EMPTY_CLIENT = {
  name: "", whatsapp: "", main: "Instagram" as Client["main"],
  bought: "no" as "yes" | "no", lastPurchase: "", nextContact: "",
};
const EMPTY_PRODUCT = { code: "", name: "", brand: "", category: "", durationDays: "30" };

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function HubPage() {
  const [tab, setTab] = useState<"clientes" | "productos">("clientes");
  const { items: clients, add: addClient, update: updateClient, remove: removeClient } = useClients();
  const { items: products, add: addProduct, update: updateProduct, remove: removeProduct } = useProducts();

  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<"all" | Client["main"]>("all");
  const [bought, setBought] = useState<"all" | "yes" | "no">("all");

  /* Vista de clientes: tarjetas o tabla (persistida en localStorage) */
  const [clientView, setClientView] = useState<"cards" | "table">(() => {
    if (typeof window === "undefined") return "cards";
    return window.localStorage.getItem("hub-view") === "table" ? "table" : "cards";
  });
  function changeClientView(v: "cards" | "table") {
    setClientView(v);
    if (typeof window !== "undefined") window.localStorage.setItem("hub-view", v);
  }

  /* Modal cliente (crear / editar) */
  const [clientModal, setClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [cf, setCf] = useState(EMPTY_CLIENT);

  /* Modal producto (crear / editar) */
  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pf, setPf] = useState(EMPTY_PRODUCT);

  /* Borrado en 2 clics ("c:<id>" | "p:<code>") */
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  useEffect(() => {
    if (!confirmKey) return;
    const t = setTimeout(() => setConfirmKey(null), 2600);
    return () => clearTimeout(t);
  }, [confirmKey]);
  function tapDelete(key: string, run: () => void) {
    if (confirmKey === key) {
      run();
      setConfirmKey(null);
    } else setConfirmKey(key);
  }

  const stats = useMemo(() => {
    const total = clients.length;
    const boughtCount = clients.filter((c) => c.bought).length;
    const upcoming = clients.filter((c) => c.nextContact && daysUntil(c.nextContact) <= 7).length;
    return { total, boughtCount, noBuy: total - boughtCount, upcoming };
  }, [clients]);

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

  /* ---------------- CRUD clientes ---------------- */

  function openCreateClient() {
    setEditingClient(null);
    setCf(EMPTY_CLIENT);
    setClientModal(true);
  }
  function openEditClient(c: Client) {
    setEditingClient(c);
    setCf({
      name: c.name, whatsapp: c.whatsapp, main: c.main,
      bought: c.bought ? "yes" : "no",
      lastPurchase: c.lastPurchase ?? "", nextContact: c.nextContact ?? "",
    });
    setClientModal(true);
  }
  function saveClient() {
    const name = cf.name.trim();
    if (!name) return;
    const isBought = cf.bought === "yes";
    const data = {
      name,
      whatsapp: cf.whatsapp.trim(),
      main: cf.main,
      bought: isBought,
      lastPurchase: isBought && cf.lastPurchase ? cf.lastPurchase : undefined,
      nextContact: isBought && cf.nextContact ? cf.nextContact : undefined,
    };
    if (editingClient) updateClient(editingClient.id, data);
    else addClient({ id: "c" + Date.now(), ...data });
    setClientModal(false);
  }

  /* ---------------- CRUD productos ---------------- */

  function openCreateProduct() {
    setEditingProduct(null);
    setPf(EMPTY_PRODUCT);
    setProductModal(true);
  }
  function openEditProduct(p: Product) {
    setEditingProduct(p);
    setPf({ code: p.code, name: p.name, brand: p.brand, category: p.category, durationDays: String(p.durationDays) });
    setProductModal(true);
  }
  const codeTaken = !editingProduct && products.some((p) => p.code === pf.code.trim());
  function saveProduct() {
    const code = pf.code.trim();
    const name = pf.name.trim();
    if (!code || !name || codeTaken) return;
    const data = {
      name,
      brand: pf.brand.trim(),
      category: pf.category.trim(),
      durationDays: Math.max(1, Number(pf.durationDays) || 30),
    };
    if (editingProduct) updateProduct(editingProduct.code, data);
    else addProduct({ code, ...data });
    setProductModal(false);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Datos comerciales"
        title="HUB Clientes / Productos"
        description="La duración de cada producto calcula cuándo volver a contactar al cliente y alimenta la tarea «Nutrición de Leads»."
        action={
          <Button onClick={() => (tab === "clientes" ? openCreateClient() : openCreateProduct())}>
            <Plus className="h-4 w-4" /> {tab === "clientes" ? "Nuevo cliente" : "Nuevo producto"}
          </Button>
        }
      />

      {/* ---------------- Mini-stats ---------------- */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Reveal delay={0}>
          <StatCard label="Clientes" value={String(stats.total)} hint="en seguimiento" icon={<Users className="h-4 w-4" />} />
        </Reveal>
        <Reveal delay={0.05}>
          <StatCard
            label="Compraron"
            value={String(stats.boughtCount)}
            hint={stats.total ? `${Math.round((stats.boughtCount / stats.total) * 100)}% del total` : "todavía nadie"}
            icon={<ShoppingBag className="h-4 w-4" />}
          />
        </Reveal>
        <Reveal delay={0.1}>
          <StatCard label="Sin compra" value={String(stats.noBuy)} hint="oportunidades abiertas" icon={<UserPlus className="h-4 w-4" />} />
        </Reveal>
        <Reveal delay={0.15}>
          <div className={stats.upcoming > 0 ? "ring-glow rounded-2xl" : ""}>
            <StatCard label="Contactos próximos" value={String(stats.upcoming)} hint="en 7 días o menos" icon={<CalendarClock className="h-4 w-4" />} />
          </div>
        </Reveal>
      </div>

      {/* ---------------- Toolbar ---------------- */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "clientes", label: "Clientes", badge: <span className="glow-text num">{clients.length}</span> },
            { value: "productos", label: "Productos", badge: <span className="glow-text num">{products.length}</span> },
          ]}
        />
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "clientes" ? "Buscar cliente…" : "Buscar por nombre o marca…"}
            aria-label="Buscar"
            className="field pl-9"
          />
        </div>
        {tab === "clientes" && (
          <>
            <Select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className="w-auto" aria-label="Filtrar por canal">
              <option value="all">Todos los canales</option>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select value={bought} onChange={(e) => setBought(e.target.value as typeof bought)} className="w-auto" aria-label="Filtrar por compra">
              <option value="all">Compra: todos</option>
              <option value="yes">Compró</option>
              <option value="no">Sin compra</option>
            </Select>
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1" role="group" aria-label="Tipo de vista">
              <button
                type="button"
                aria-label="Vista tarjetas"
                aria-pressed={clientView === "cards"}
                {...cursorIntentProps("open", "Vista tarjetas")}
                onClick={() => changeClientView("cards")}
                className={`press flex h-8 w-8 items-center justify-center rounded-lg transition ${
                  clientView === "cards" ? "bg-white/10 text-white" : "text-[var(--muted)] hover:text-white"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Vista tabla"
                aria-pressed={clientView === "table"}
                {...cursorIntentProps("open", "Vista tabla")}
                onClick={() => changeClientView("table")}
                className={`press flex h-8 w-8 items-center justify-center rounded-lg transition ${
                  clientView === "table" ? "bg-white/10 text-white" : "text-[var(--muted)] hover:text-white"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ---------------- Contenido ---------------- */}
      {tab === "clientes" ? (
        filtered.length === 0 ? (
          <motion.div key="clientes-vacio" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title={clients.length === 0 ? "Sin clientes todavía" : "Nada que coincida"}
              hint={
                clients.length === 0
                  ? "Cargá tu primer cliente y empezá el seguimiento comercial."
                  : "Probá con otra búsqueda o cambiá los filtros."
              }
              action={clients.length === 0 ? <Button onClick={openCreateClient}><Plus className="h-4 w-4" /> Nuevo cliente</Button> : undefined}
            />
          </motion.div>
        ) : clientView === "cards" ? (
        <motion.div key="clientes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c, i) => {
            const key = "c:" + c.id;
            const armed = confirmKey === key;
            const wa = waHref(c.whatsapp);
            const du = c.nextContact ? daysUntil(c.nextContact) : null;
            const urgent = du !== null && du <= 3;
            return (
              <Reveal key={c.id} delay={Math.min(i * 0.04, 0.4)} className="h-full">
                <Card className="card-sheen group relative flex h-full flex-col p-5">
                  {/* acciones — siempre visibles, resaltan al hover */}
                  <div className={`absolute right-3 top-3 z-10 flex gap-1 transition ${armed ? "opacity-100" : "opacity-70"} focus-within:opacity-100 group-hover:opacity-100`}>
                    <button
                      type="button"
                      aria-label={`Editar a ${c.name}`}
                      {...cursorIntentProps("edit")}
                      onClick={() => openEditClient(c)}
                      className="press flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-[var(--muted)] backdrop-blur transition hover:border-white/25 hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={armed ? `Confirmar eliminación de ${c.name}` : `Eliminar a ${c.name}`}
                      {...cursorIntentProps("danger", armed ? "¿Seguro?" : "Eliminar")}
                      onClick={() => tapDelete(key, () => removeClient(c.id))}
                      className={`press flex h-9 items-center justify-center rounded-lg border backdrop-blur transition ${
                        armed
                          ? "border-red-400/40 bg-red-500/15 px-2.5 text-[11px] font-semibold text-red-300"
                          : "w-9 border-white/10 bg-black/40 text-[var(--muted)] hover:border-red-400/40 hover:text-red-300"
                      }`}
                    >
                      {armed ? "¿Seguro?" : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {/* cabecera */}
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-lg font-semibold text-white"
                      style={{
                        background: "linear-gradient(135deg, rgba(214,171,153,0.55) 0%, rgba(153,102,80,0.28) 55%, rgba(214,171,153,0.1) 100%)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
                      }}
                      aria-hidden
                    >
                      {(c.name.trim().charAt(0) || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate pr-14 text-[15px] font-semibold text-white">{c.name}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${CHANNEL_META[c.main].chip}`}>
                          {CHANNEL_META[c.main].icon} {c.main}
                        </span>
                        {c.bought ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                            <ShoppingBag className="h-3 w-3" /> Compró
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[var(--faint)]">Sin compra</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* seguimiento */}
                  {c.bought ? (
                    <div className="mt-4 space-y-1.5 rounded-xl border border-white/8 bg-black/20 p-3 text-xs">
                      <p className="flex items-center justify-between gap-2 text-[var(--muted)]">
                        <span>Última compra</span>
                        <span className="num text-white">{c.lastPurchase ? fmtShortDate(c.lastPurchase) : "—"}</span>
                      </p>
                      {c.nextContact && du !== null ? (
                        <p className={`flex items-center justify-between gap-2 ${urgent ? "text-amber-300" : "text-nude"}`}>
                          <span className="flex items-center gap-1.5">
                            <Bell className={`h-3 w-3 shrink-0 ${urgent ? "glow-pulse rounded-full" : ""}`} /> Próximo contacto
                          </span>
                          <span className="num font-medium">{fmtShortDate(c.nextContact)} · {contactLabel(du)}</span>
                        </p>
                      ) : (
                        <p className="flex items-center justify-between gap-2 text-[var(--faint)]">
                          <span>Próximo contacto</span>
                          <span>sin agendar</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-white/10 p-3 text-xs leading-relaxed text-[var(--muted)]">
                      Sin compra todavía — <span className="glow-text font-medium">escribile</span> y programá el primer mensaje de interacción.
                    </div>
                  )}

                  {/* pie */}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        data-cursor-color="#25D366"
                        data-cursor-label="WhatsApp"
                        className="press inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-3 text-xs font-medium text-emerald-300 transition hover:border-[#25D366]/50 hover:bg-[#25D366]/20"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> {c.whatsapp}
                      </a>
                    ) : (
                      <span className="text-[11px] text-[var(--faint)]">Sin número cargado</span>
                    )}
                  </div>
                </Card>
              </Reveal>
            );
          })}
        </motion.div>
        ) : (
          <motion.div key="clientes-tabla" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <Card className="overflow-hidden" hover={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/8 text-[var(--muted)]">
                      <th className="px-5 py-3 font-medium">Cliente</th>
                      <th className="px-5 py-3 font-medium">Canal</th>
                      <th className="px-5 py-3 font-medium">WhatsApp</th>
                      <th className="px-5 py-3 font-medium">Compra</th>
                      <th className="px-5 py-3 font-medium">Última compra</th>
                      <th className="px-5 py-3 font-medium">Próximo contacto</th>
                      <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => {
                      const key = "c:" + c.id;
                      const armed = confirmKey === key;
                      const wa = waHref(c.whatsapp);
                      const du = c.nextContact ? daysUntil(c.nextContact) : null;
                      const urgent = du !== null && du <= 3;
                      return (
                        <motion.tr
                          key={c.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease: EASE, delay: Math.min(i * 0.03, 0.35) }}
                          className="group border-b border-white/6 transition-colors last:border-0 hover:bg-white/[0.04]"
                        >
                          <td className="px-5 py-3">
                            <span className="flex items-center gap-2.5">
                              <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-semibold text-white"
                                style={{ background: "linear-gradient(135deg, rgba(214,171,153,0.55) 0%, rgba(153,102,80,0.28) 55%, rgba(214,171,153,0.1) 100%)" }}
                                aria-hidden
                              >
                                {(c.name.trim().charAt(0) || "?").toUpperCase()}
                              </span>
                              <span className="font-medium text-white">{c.name}</span>
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${CHANNEL_META[c.main].chip}`}>
                              {CHANNEL_META[c.main].icon} {c.main}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {wa ? (
                              <a
                                href={wa}
                                target="_blank"
                                rel="noreferrer"
                                data-cursor-color="#25D366"
                                data-cursor-label="WhatsApp"
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 transition hover:text-emerald-200"
                              >
                                <MessageCircle className="h-3.5 w-3.5" /> {c.whatsapp}
                              </a>
                            ) : (
                              <span className="text-xs text-[var(--faint)]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {c.bought ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                                <ShoppingBag className="h-3 w-3" /> Compró
                              </span>
                            ) : (
                              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[var(--faint)]">Sin compra</span>
                            )}
                          </td>
                          <td className="num px-5 py-3 text-xs text-[var(--muted)]">{c.lastPurchase ? fmtShortDate(c.lastPurchase) : "—"}</td>
                          <td className="px-5 py-3 text-xs">
                            {c.nextContact && du !== null ? (
                              <span className={`num inline-flex items-center gap-1.5 font-medium ${urgent ? "text-amber-300" : "text-nude"}`}>
                                {urgent && <Bell className="glow-pulse h-3 w-3 shrink-0 rounded-full" />}
                                {fmtShortDate(c.nextContact)} · {contactLabel(du)}
                              </span>
                            ) : (
                              <span className="text-[var(--faint)]">sin agendar</span>
                            )}
                          </td>
                          <td className="px-5 py-2">
                            <div className={`flex justify-end gap-1 transition ${armed ? "opacity-100" : "opacity-70"} focus-within:opacity-100 group-hover:opacity-100`}>
                              <button
                                type="button"
                                aria-label={`Editar a ${c.name}`}
                                {...cursorIntentProps("edit")}
                                onClick={() => openEditClient(c)}
                                className="press flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-[var(--muted)] transition hover:border-white/25 hover:text-white"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={armed ? `Confirmar eliminación de ${c.name}` : `Eliminar a ${c.name}`}
                                {...cursorIntentProps("danger", armed ? "¿Seguro?" : "Eliminar")}
                                onClick={() => tapDelete(key, () => removeClient(c.id))}
                                className={`press flex h-9 items-center justify-center rounded-lg border transition ${
                                  armed
                                    ? "border-red-400/40 bg-red-500/15 px-2.5 text-[11px] font-semibold text-red-300"
                                    : "w-9 border-white/10 bg-black/30 text-[var(--muted)] hover:border-red-400/40 hover:text-red-300"
                                }`}
                              >
                                {armed ? "¿Seguro?" : <Trash2 className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        )
      ) : (
        <motion.div key="productos" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
          {prodFiltered.length === 0 ? (
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title={products.length === 0 ? "Sin productos todavía" : "Nada que coincida"}
              hint={
                products.length === 0
                  ? "Cargá tu primer producto — su duración define cuándo recontactar a quien lo compró."
                  : "Probá con otra búsqueda."
              }
              action={products.length === 0 ? <Button onClick={openCreateProduct}><Plus className="h-4 w-4" /> Nuevo producto</Button> : undefined}
            />
          ) : (
            <Card className="overflow-hidden" hover={false}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/8 text-[var(--muted)]">
                      <th className="px-5 py-3 font-medium">Código</th>
                      <th className="px-5 py-3 font-medium">Producto</th>
                      <th className="px-5 py-3 font-medium">Marca</th>
                      <th className="px-5 py-3 font-medium">Categoría</th>
                      <th className="px-5 py-3 font-medium">Duración</th>
                      <th className="px-5 py-3"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodFiltered.map((p, i) => {
                      const key = "p:" + p.code;
                      const armed = confirmKey === key;
                      return (
                        <motion.tr
                          key={p.code}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease: EASE, delay: Math.min(i * 0.04, 0.4) }}
                          className="group border-b border-white/6 transition-colors last:border-0 hover:bg-white/[0.04]"
                        >
                          <td className="px-5 py-3.5 font-mono text-xs text-[var(--faint)]">{p.code}</td>
                          <td className="px-5 py-3.5 font-medium text-white">{p.name}</td>
                          <td className="px-5 py-3.5">
                            <span className="rounded-full bg-nude/10 px-2 py-0.5 text-xs text-nude">{p.brand || "—"}</span>
                          </td>
                          <td className="px-5 py-3.5 text-[var(--muted)]">{p.category || "—"}</td>
                          <td className="px-5 py-3.5 text-[var(--muted)]">
                            <span className="num text-white">{p.durationDays}</span> días
                          </td>
                          <td className="px-5 py-2">
                            <div className={`flex justify-end gap-1 transition ${armed ? "opacity-100" : "opacity-70"} focus-within:opacity-100 group-hover:opacity-100`}>
                              <button
                                type="button"
                                aria-label={`Editar ${p.name}`}
                                {...cursorIntentProps("edit")}
                                onClick={() => openEditProduct(p)}
                                className="press flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-[var(--muted)] transition hover:border-white/25 hover:text-white"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={armed ? `Confirmar eliminación de ${p.name}` : `Eliminar ${p.name}`}
                                {...cursorIntentProps("danger", armed ? "¿Seguro?" : "Eliminar")}
                                onClick={() => tapDelete(key, () => removeProduct(p.code))}
                                className={`press flex h-9 items-center justify-center rounded-lg border transition ${
                                  armed
                                    ? "border-red-400/40 bg-red-500/15 px-2.5 text-[11px] font-semibold text-red-300"
                                    : "w-9 border-white/10 bg-black/30 text-[var(--muted)] hover:border-red-400/40 hover:text-red-300"
                                }`}
                              >
                                {armed ? "¿Seguro?" : <Trash2 className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </motion.div>
      )}

      {/* ---------------- Modal cliente ---------------- */}
      <Modal
        open={clientModal}
        onClose={() => setClientModal(false)}
        title={editingClient ? "Editar cliente" : "Nuevo cliente"}
        description="El próximo contacto alimenta la tarea «Nutrición de Leads»."
        footer={
          <>
            <Button variant="ghost" onClick={() => setClientModal(false)}>Cancelar</Button>
            <Button onClick={saveClient} disabled={!cf.name.trim()}>
              {editingClient ? "Guardar cambios" : "Agregar cliente"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre">
            <Input autoFocus value={cf.name} onChange={(e) => setCf((s) => ({ ...s, name: e.target.value }))} placeholder="Nombre y apellido" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="WhatsApp">
              <Input value={cf.whatsapp} onChange={(e) => setCf((s) => ({ ...s, whatsapp: e.target.value }))} placeholder="09xx xxx xxx" />
            </Field>
            <Field label="Canal principal">
              <Select value={cf.main} onChange={(e) => setCf((s) => ({ ...s, main: e.target.value as Client["main"] }))}>
                {CHANNELS.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">¿Compró producto?</span>
            <Segmented
              value={cf.bought}
              onChange={(v) => setCf((s) => ({ ...s, bought: v }))}
              options={[{ value: "no", label: "Sin compra" }, { value: "yes", label: "Compró" }]}
            />
          </div>
          {cf.bought === "yes" && (
            <div className="animate-fade-up grid grid-cols-2 gap-3">
              <Field label="Última compra">
                <Input type="date" value={cf.lastPurchase} onChange={(e) => setCf((s) => ({ ...s, lastPurchase: e.target.value }))} />
              </Field>
              <Field label="Próximo contacto">
                <Input type="date" value={cf.nextContact} onChange={(e) => setCf((s) => ({ ...s, nextContact: e.target.value }))} />
              </Field>
            </div>
          )}
        </div>
      </Modal>

      {/* ---------------- Modal producto ---------------- */}
      <Modal
        open={productModal}
        onClose={() => setProductModal(false)}
        title={editingProduct ? "Editar producto" : "Nuevo producto"}
        description="La duración define cuándo volver a contactar a quien lo compró."
        footer={
          <>
            <Button variant="ghost" onClick={() => setProductModal(false)}>Cancelar</Button>
            <Button onClick={saveProduct} disabled={!pf.code.trim() || !pf.name.trim() || codeTaken}>
              {editingProduct ? "Guardar cambios" : "Agregar producto"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código">
              <Input
                value={pf.code}
                onChange={(e) => setPf((s) => ({ ...s, code: e.target.value }))}
                placeholder="EL-010"
                disabled={!!editingProduct}
                className={editingProduct ? "opacity-50" : ""}
              />
              {editingProduct ? (
                <p className="mt-1 text-[11px] text-[var(--faint)]">El código identifica al producto — no se puede cambiar.</p>
              ) : codeTaken ? (
                <p className="mt-1 text-[11px] text-amber-300">Ese código ya existe.</p>
              ) : null}
            </Field>
            <Field label="Duración (días)">
              <Input type="number" min={1} value={pf.durationDays} onChange={(e) => setPf((s) => ({ ...s, durationDays: e.target.value }))} />
            </Field>
          </div>
          <Field label="Nombre">
            <Input value={pf.name} onChange={(e) => setPf((s) => ({ ...s, name: e.target.value }))} placeholder="Sérum Vitamina C" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marca">
              <Input value={pf.brand} onChange={(e) => setPf((s) => ({ ...s, brand: e.target.value }))} />
            </Field>
            <Field label="Categoría">
              <Input value={pf.category} onChange={(e) => setPf((s) => ({ ...s, category: e.target.value }))} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
