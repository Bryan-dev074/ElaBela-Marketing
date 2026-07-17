"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, Plus, Copy, Check, Pencil, Trash2, Globe, ShieldCheck } from "lucide-react";
import { PageHeader, Card, Button, Modal, Field, Input, Select } from "@/components/ui";
import { IconPicker } from "@/components/IconPicker";
import { useCredentials, type CredRow } from "@/lib/db";
import type { Role } from "@/lib/brand";

type Cred = CredRow;
const empty = (scope: Cred["scope"]): Cred => ({ id: "", platform: "", icon: "🔑", idType: "email", identifier: "", secret: "", scope });

/** Valor secreto que pasa de puntos borrosos a texto nítido con una transición blur → sharp. */
function RevealValue({ show, value, hidden }: { show: boolean; value: string; hidden: string }) {
  return (
    <span className="relative inline-flex">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={show ? "visible" : "hidden"}
          initial={{ opacity: 0, filter: "blur(7px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(7px)" }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block"
        >
          {show ? value || "—" : hidden}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Ícono de copiar que se transforma en check con un pop animado. */
function CopyIcon({ done }: { done: boolean }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={done ? "check" : "copy"}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.4, opacity: 0 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="inline-flex"
      >
        {done ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </motion.span>
    </AnimatePresence>
  );
}

function Row({ c, onEdit, onDelete }: { c: Cred; onEdit: () => void; onDelete: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    if (armTimer.current) clearTimeout(armTimer.current);
  }, []);

  const configured = c.identifier || c.secret;
  const copy = (v: string, k: string) =>
    v && navigator.clipboard?.writeText(v).then(() => {
      setCopied(k);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1400);
    });
  const handleDelete = () => {
    if (armed) {
      if (armTimer.current) clearTimeout(armTimer.current);
      onDelete();
      return;
    }
    setArmed(true);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmed(false), 2600);
  };

  const iconBtn = "press flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-[var(--faint)] transition hover:border-white/20 hover:bg-white/5 hover:text-white";

  return (
    <div className="card-sheen group flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3 transition-colors duration-200 hover:border-nude/20 hover:bg-black/30">
      <span className="text-lg">{c.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{c.platform}</p>
        {configured ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs text-[var(--muted)]">
            <span className="capitalize text-[var(--faint)]">{c.idType}:</span>
            <button
              type="button"
              onClick={() => copy(c.identifier, "id-" + c.id)}
              className="press inline-flex items-center gap-1 rounded transition hover:text-white"
              data-cursor-label="Copiar"
              aria-label={`Copiar ${c.idType === "email" ? "correo" : "usuario"}`}
            >
              <RevealValue show={show} value={c.identifier} hidden={"•".repeat(Math.min(10, (c.identifier || "······").length))} />
              {copied === "id-" + c.id && (
                <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex">
                  <Check className="h-3 w-3 text-emerald-400" />
                </motion.span>
              )}
            </button>
            <span className="text-[var(--faint)]">clave:</span>
            <RevealValue show={show} value={c.secret} hidden="••••••••" />
          </div>
        ) : (
          <p className="font-mono text-xs text-[var(--faint)]">— sin configurar —</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {configured && (
          <>
            <button
              onClick={() => setShow((s) => !s)}
              className={iconBtn}
              aria-label={show ? "Ocultar valores" : "Mostrar valores"}
              data-cursor-label={show ? "Ocultar" : "Mostrar"}
            >
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => copy(c.secret, "sec-" + c.id)}
              className={iconBtn}
              aria-label="Copiar contraseña"
              data-cursor-label="Copiar"
            >
              <CopyIcon done={copied === "sec-" + c.id} />
            </button>
          </>
        )}
        <button onClick={onEdit} className={iconBtn} aria-label="Editar acceso" data-cursor-label="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleDelete}
          className={`press flex h-8 items-center justify-center rounded-lg border text-xs transition ${
            armed
              ? "border-red-400/40 bg-red-500/15 px-2.5 font-medium text-red-300"
              : "w-8 border-white/10 text-[var(--faint)] opacity-0 hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
          }`}
          aria-label={armed ? "Confirmar eliminación" : "Eliminar acceso"}
          data-cursor-label={armed ? "Confirmar" : "Eliminar"}
          data-cursor-color="#f87171"
        >
          {armed ? "¿Seguro?" : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export default function CredencialesView({ role, ownerId }: { role: Role; ownerId: string }) {
  void role;
  const { items: creds, add, update, remove } = useCredentials(ownerId);
  const [editing, setEditing] = useState<Cred | null>(null);

  const shared = creds.filter((c) => c.scope === "shared");
  const priv = creds.filter((c) => c.scope === "private" && (!c.ownerId || c.ownerId === ownerId));

  function save() {
    if (!editing || !editing.platform.trim()) return;
    if (editing.id) update(editing.id, editing);
    else add({ ...editing, id: "c" + Date.now() });
    setEditing(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Seguridad"
        title="Credenciales"
        description="Dos niveles bien claros: las compartidas las ve todo el equipo; las privadas solo vos."
        action={<Button onClick={() => setEditing(empty("private"))}><Plus className="h-4 w-4" /> Agregar acceso</Button>}
      />

      <Card className="mb-6 flex items-center gap-3.5 border-amber-400/15 bg-gradient-to-r from-amber-400/[0.07] via-amber-400/[0.03] to-transparent p-4" hover={false}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
          <ShieldCheck className="h-4 w-4 text-amber-300" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-amber-200">Guardado seguro</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-200/60">Los valores se cifran en producción y nunca tocan el repositorio. Cargalos acá, mostralos y copialos cuando los necesités.</p>
        </div>
      </Card>

      {/* Shared */}
      <Card className="mb-6 p-6" hover={false}>
        <div className="mb-1 flex items-center gap-2">
          <Globe className="h-5 w-5 text-emerald-300" />
          <h2 className="text-lg font-semibold text-white">Compartidas del equipo</h2>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 shadow-[0_0_18px_-6px_rgba(52,211,153,0.6)]">Todos las ven</span>
        </div>
        <p className="mb-4 text-xs text-[var(--muted)]">Cuentas y herramientas que usa todo el equipo.</p>
        <div className="space-y-2.5">
          {shared.map((c) => <Row key={c.id} c={c} onEdit={() => setEditing(c)} onDelete={() => remove(c.id)} />)}
          {shared.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-[var(--muted)]">Todavía no hay accesos compartidos. Creá uno y elegí «Compartida».</div>
          )}
        </div>
      </Card>

      {/* Private */}
      <Card className="p-6" hover={false}>
        <div className="mb-1 flex items-center gap-2">
          <Lock className="h-5 w-5 text-nude" />
          <h2 className="text-lg font-semibold text-white">Mis credenciales privadas</h2>
          <span className="glow-pulse inline-flex items-center rounded-full border border-nude/30 bg-nude/10 px-2 py-0.5 text-[10px] font-medium">
            <span className="glow-text">Solo vos</span>
          </span>
        </div>
        <p className="mb-4 text-xs text-[var(--muted)]">Solo vos ves estas. Nadie más del equipo tiene acceso.</p>
        <div className="space-y-2.5">
          {priv.map((c) => <Row key={c.id} c={c} onEdit={() => setEditing(c)} onDelete={() => remove(c.id)} />)}
          {priv.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-[var(--muted)]">Sin credenciales privadas. Agregá una con «Agregar acceso».</div>
          )}
        </div>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar acceso" : "Nuevo acceso"}
        description="Elegí si es compartida (todos) o privada (solo vos), y si el identificador es correo o usuario."
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}>
        {editing && (
          <div className="space-y-4">
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Visibilidad</span>
              <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                <button type="button" onClick={() => setEditing({ ...editing, scope: "shared" })} className={`press flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${editing.scope === "shared" ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"}`}><Globe className="h-3.5 w-3.5" /> Compartida</button>
                <button type="button" onClick={() => setEditing({ ...editing, scope: "private" })} className={`press flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${editing.scope === "private" ? "bg-white text-black" : "text-[var(--muted)] hover:text-white"}`}><Lock className="h-3.5 w-3.5" /> Privada</button>
              </div>
            </div>
            <div className="flex gap-3">
              <div>
                <Field label="Ícono">
                  <IconPicker value={editing.icon} onChange={(icon) => setEditing({ ...editing, icon })} />
                </Field>
              </div>
              <div className="flex-1"><Field label="Plataforma"><Input value={editing.platform} onChange={(e) => setEditing({ ...editing, platform: e.target.value })} placeholder="Ej: Instagram" /></Field></div>
            </div>
            <Field label="Tipo de identificador"><Select value={editing.idType} onChange={(e) => setEditing({ ...editing, idType: e.target.value as Cred["idType"] })}><option value="email">Correo</option><option value="usuario">Usuario</option></Select></Field>
            <Field label={editing.idType === "email" ? "Correo" : "Usuario"}><Input value={editing.identifier} onChange={(e) => setEditing({ ...editing, identifier: e.target.value })} placeholder={editing.idType === "email" ? "correo@ejemplo.com" : "@usuario"} /></Field>
            <Field label="Contraseña"><Input value={editing.secret} onChange={(e) => setEditing({ ...editing, secret: e.target.value })} placeholder="••••••••" /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
