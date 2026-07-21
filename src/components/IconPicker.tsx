"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ImagePlus, Trash2 } from "lucide-react";
import { IconGlyph } from "@/components/ui";
import { cursorIntentProps } from "@/lib/cursor-intent";
import { useDialogPortalTarget } from "@/components/dialog-portal";
import { fileToImage } from "@/lib/profiles";

/**
 * Icon picker: a trigger showing the current icon that opens a floating panel
 * with categorised, searchable emojis — plus upload of a custom image or GIF
 * (GIFs keep their animation; static images get compressed).
 */

const GIF_MAX_BYTES = 2_500_000;

type EmojiDef = { e: string; k: string };
const CATS: { id: string; label: string; items: EmojiDef[] }[] = [
  {
    id: "marketing",
    label: "Marketing",
    items: [
      { e: "📣", k: "megafono anuncio ads promo" }, { e: "📢", k: "altavoz anuncio" }, { e: "🎯", k: "objetivo meta target" },
      { e: "🚀", k: "lanzamiento crecimiento" }, { e: "📈", k: "crecimiento grafico ventas" }, { e: "📊", k: "estadisticas metricas grafico" },
      { e: "💡", k: "idea creatividad" }, { e: "🔥", k: "trend viral fuego" }, { e: "⭐", k: "estrella destacado" },
      { e: "✨", k: "brillo glow magia" }, { e: "💎", k: "gema premium diamante" }, { e: "🏆", k: "logro premio trofeo" },
      { e: "🛒", k: "carrito compra venta" }, { e: "🛍️", k: "compras bolsa venta" }, { e: "💰", k: "dinero ventas plata" },
      { e: "🤝", k: "cliente acuerdo alianza" }, { e: "🌱", k: "leads nutricion crecer" }, { e: "🧲", k: "atraer leads iman" },
    ],
  },
  {
    id: "contenido",
    label: "Contenido",
    items: [
      { e: "🎬", k: "video claqueta grabar" }, { e: "🎥", k: "camara video grabar" }, { e: "📸", k: "foto camara instagram" },
      { e: "🎨", k: "diseño arte portada" }, { e: "🖼️", k: "imagen cuadro pedestal" }, { e: "✂️", k: "editar cortar edicion" },
      { e: "🎠", k: "carrusel slides" }, { e: "📚", k: "tutorial carrusel libros" }, { e: "📝", k: "guion escribir nota" },
      { e: "🎙️", k: "locucion voz microfono podcast" }, { e: "🎵", k: "musica audio tiktok" }, { e: "🧑‍🎤", k: "avatar presentador persona" },
      { e: "📤", k: "subir publicar post" }, { e: "📲", k: "historias celular publicar" }, { e: "🖥️", k: "web banner computadora" },
      { e: "🔄", k: "cambiar rotar actualizar" }, { e: "📅", k: "calendario programar fecha" }, { e: "⏰", k: "horario reloj alarma" },
    ],
  },
  {
    id: "redes",
    label: "Redes",
    items: [
      { e: "💬", k: "chat mensaje whatsapp comentario" }, { e: "👥", k: "comunidad grupo equipo" }, { e: "❤️", k: "like corazon amor" },
      { e: "👍", k: "like pulgar ok" }, { e: "🔔", k: "notificacion campana avisos" }, { e: "📩", k: "mensaje correo dm" },
      { e: "🔗", k: "link enlace" }, { e: "🌐", k: "web internet global" }, { e: "📱", k: "celular movil app" },
      { e: "📘", k: "facebook libro azul" }, { e: "🎞️", k: "reel pelicula video" }, { e: "🗨️", k: "responder chats redes" },
    ],
  },
  {
    id: "belleza",
    label: "Belleza",
    items: [
      { e: "💄", k: "labial maquillaje belleza" }, { e: "💅", k: "uñas belleza glam" }, { e: "🧴", k: "crema serum skincare" },
      { e: "🧖‍♀️", k: "spa skincare rutina" }, { e: "🌸", k: "flor delicado rosa" }, { e: "🌺", k: "flor tropical" },
      { e: "🦋", k: "mariposa glow transformacion" }, { e: "👑", k: "corona reina premium" }, { e: "💫", k: "brillo estrellas glow" },
      { e: "🌙", k: "noche rutina luna" }, { e: "☀️", k: "dia sol protector solar" }, { e: "💧", k: "hidratacion agua gota" },
    ],
  },
  {
    id: "trabajo",
    label: "Trabajo",
    items: [
      { e: "✅", k: "listo check hecho" }, { e: "📌", k: "pin fijar importante" }, { e: "📋", k: "lista tareas checklist" },
      { e: "🗂️", k: "archivos organizar carpetas" }, { e: "📁", k: "carpeta proyecto" }, { e: "🔑", k: "clave acceso credencial llave" },
      { e: "🔒", k: "privado seguro candado" }, { e: "⚙️", k: "configuracion ajustes engranaje" }, { e: "🧰", k: "herramientas tools caja" },
      { e: "🤖", k: "ia robot inteligencia artificial" }, { e: "🧠", k: "cerebro ia idea estrategia" }, { e: "⚡", k: "rapido energia rayo" },
      { e: "🕐", k: "hora reloj tiempo" }, { e: "🗓️", k: "agenda calendario plan" }, { e: "📦", k: "producto paquete catalogo" },
      { e: "🎉", k: "fiesta especial festejo" }, { e: "🎁", k: "regalo sorteo promo" }, { e: "🏛️", k: "pedestal clasico columna" },
    ],
  },
];

const ALL = CATS.flatMap((c) => c.items.map((i) => ({ ...i, cat: c.id })));

export function IconPicker({
  value,
  onChange,
  size = 42,
  className = "",
}: {
  value: string;
  onChange: (icon: string) => void;
  /** Trigger square size in px. */
  size?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const portalTarget = useDialogPortalTarget();
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false });

  const isImage = value?.startsWith("data:") || value?.startsWith("http");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploadErr(null);
    try {
      if (f.type === "image/gif") {
        // GIFs stay raw so the animation survives — just cap the size.
        if (f.size > GIF_MAX_BYTES) {
          setUploadErr("El GIF es muy pesado (máx. 2,5 MB).");
          return;
        }
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.onerror = () => rej(new Error("No se pudo leer el GIF"));
          r.readAsDataURL(f);
        });
        onChange(dataUrl);
      } else {
        onChange(await fileToImage(f, 256));
      }
      closePanel();
    } catch {
      setUploadErr("No se pudo procesar la imagen.");
    }
  }

  const openPanel = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const panelH = 340, panelW = 304;
      const up = r.bottom + panelH + 12 > window.innerHeight && r.top - panelH - 12 > 0;
      setPos({
        top: up ? r.top - panelH - 8 : r.bottom + 8,
        left: Math.min(Math.max(8, r.left), window.innerWidth - panelW - 8),
        up,
      });
    }
    setQ("");
    setUploadErr(null);
    setOpen(true);
  };

  const closePanel = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    // Capture + preventDefault so Escape closes ONLY the popover, not a parent Modal.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [closePanel, open]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return null;
    return ALL.filter((i) => i.k.includes(t) || i.e === t);
  }, [q]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openPanel}
        className={`press flex items-center justify-center rounded-xl border border-[var(--border)] bg-black/35 text-xl transition hover:border-nude/50 hover:bg-black/50 ${className}`}
        style={{ width: size, height: size }}
        aria-label="Elegir ícono"
        {...cursorIntentProps("open", "Elegir ícono")}
      >
        <IconGlyph icon={value} size={Math.round(size * 0.62)} rounded="rounded-md" />
      </button>

      {portalTarget &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <div className="fixed inset-0 z-[140]" onClick={closePanel} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: pos.up ? 6 : -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: pos.up ? 4 : -4 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="popover-panel fixed z-[150] w-[304px] rounded-2xl p-3"
                  style={{ top: pos.top, left: pos.left, transformOrigin: pos.up ? "bottom left" : "top left" }}
                >
                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--faint)]" />
                    <input
                      autoFocus
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Buscar… (ej: video, cliente)"
                      className="field py-2 pl-8 text-xs"
                    />
                  </div>

                  {/* Imagen o GIF propio */}
                  <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                  <div className="mb-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      {...cursorIntentProps("open", "Subir imagen o GIF")}
                      className="press flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 py-1.5 text-[11px] font-medium text-[var(--muted)] transition hover:border-nude/50 hover:text-white"
                    >
                      <ImagePlus className="h-3.5 w-3.5" /> Imagen o GIF propio
                    </button>
                    {isImage && (
                      <button
                        type="button"
                        onClick={() => { onChange("✨"); closePanel(); }}
                        aria-label="Quitar imagen"
                        {...cursorIntentProps("danger", "Quitar imagen")}
                        className="press flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-[var(--faint)] transition hover:border-red-400/40 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {uploadErr && <p className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300">{uploadErr}</p>}
                  <div className="no-scrollbar max-h-[248px] space-y-3 overflow-y-auto pr-1">
                    {results ? (
                      <div className="grid grid-cols-8 gap-0.5">
                        {results.map((i) => (
                          <EmojiBtn key={i.e + i.cat} e={i.e} active={i.e === value} onPick={() => { onChange(i.e); closePanel(); }} />
                        ))}
                        {results.length === 0 && <p className="col-span-8 py-6 text-center text-xs text-[var(--faint)]">Sin resultados</p>}
                      </div>
                    ) : (
                      CATS.map((c) => (
                        <div key={c.id}>
                          <p className="eyebrow mb-1 !text-[9px]">{c.label}</p>
                          <div className="grid grid-cols-8 gap-0.5">
                            {c.items.map((i) => (
                              <EmojiBtn key={i.e} e={i.e} active={i.e === value} onPick={() => { onChange(i.e); closePanel(); }} />
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          portalTarget,
        )}
    </>
  );
}

function EmojiBtn({ e, active, onPick }: { e: string; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`press flex h-8 w-8 items-center justify-center rounded-lg text-base transition hover:bg-white/10 ${active ? "bg-nude/20 ring-1 ring-nude/50" : ""}`}
    >
      {e}
    </button>
  );
}
