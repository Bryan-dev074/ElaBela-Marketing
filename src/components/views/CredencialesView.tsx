"use client";

import { useState } from "react";
import { Eye, EyeOff, ShieldCheck, Lock, Plus, Copy, Check, Pencil, Trash2 } from "lucide-react";
import { PageHeader, Card, Button, Modal, Field, Input, Select } from "@/components/ui";
import { CREDENTIAL_PLATFORMS } from "@/lib/data";
import type { Role } from "@/lib/brand";

interface Cred {
  id: string;
  platform: string;
  icon: string;
  idType: "email" | "usuario";
  identifier: string;
  secret: string;
  scope: "personal" | "admin";
}

const seed: Cred[] = CREDENTIAL_PLATFORMS.map((c, i) => ({
  id: "c" + i, platform: c.platform, icon: c.icon, idType: "email", identifier: "", secret: "", scope: c.scope as "personal" | "admin",
}));
const empty = (scope: Cred["scope"]): Cred => ({ id: "", platform: "", icon: "🔑", idType: "email", identifier: "", secret: "", scope });

function Row({ c, onEdit, onDelete }: { c: Cred; onEdit: () => void; onDelete: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const configured = c.identifier || c.secret;
  const copy = (v: string, k: string) => v && navigator.clipboard?.writeText(v).then(() => { setCopied(k); setTimeout(() => setCopied(null), 1200); });

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
      <span className="text-lg">{c.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white">{c.platform}</p>
        {configured ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs text-[var(--muted)]">
            <span className="capitalize text-[var(--faint)]">{c.idType}:</span>
            <span>{show ? c.identifier || "—" : "•".repeat(Math.min(10, (c.identifier || "······").length))}</span>
            <span className="text-[var(--faint)]">clave:</span>
            <span>{show ? c.secret || "—" : "••••••••"}</span>
          </div>
        ) : (
          <p className="font-mono text-xs text-[var(--faint)]">— sin configurar —</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {configured && (
          <>
            <button onClick={() => setShow((s) => !s)} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] transition hover:text-white" aria-label="Mostrar">{show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
            <button onClick={() => copy(c.secret, c.id)} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] transition hover:text-white" aria-label="Copiar clave">{copied === c.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}</button>
          </>
        )}
        <button onClick={onEdit} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] transition hover:text-white" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] opacity-0 transition group-hover:opacity-100 hover:text-red-300" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

export default function CredencialesView({ role }: { role: Role }) {
  const isAdmin = role === "admin";
  const [creds, setCreds] = useState<Cred[]>(seed);
  const [editing, setEditing] = useState<Cred | null>(null);

  const personal = creds.filter((c) => c.scope === "personal");
  const adminOnly = creds.filter((c) => c.scope === "admin");

  function save() {
    if (!editing || !editing.platform.trim()) return;
    setCreds((prev) => (editing.id ? prev.map((c) => (c.id === editing.id ? editing : c)) : [...prev, { ...editing, id: "c" + Date.now() }]));
    setEditing(null);
  }
  const remove = (id: string) => setCreds((prev) => prev.filter((c) => c.id !== id));

  return (
    <div>
      <PageHeader
        eyebrow="Seguridad"
        title="Credenciales"
        description="Gestor de accesos por niveles. Cada perfil guarda sus credenciales; solo el Admin ve las del equipo."
        action={<Button onClick={() => setEditing(empty("personal"))}><Plus className="h-4 w-4" /> Agregar acceso</Button>}
      />

      <Card className="mb-6 flex items-start gap-3 border-amber-400/20 bg-amber-400/5 p-4" hover={false}>
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <p className="text-xs text-amber-200/90">Los valores se guardan cifrados en producción y nunca en el repositorio. Acá podés cargarlos, verlos con el ojo 👁 y copiarlos.</p>
      </Card>

      <Card className="mb-6 p-6" hover={false}>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white"><ShieldCheck className="h-5 w-5 text-nude" /> Mis credenciales</h2>
        <div className="space-y-2.5">
          {personal.map((c) => <Row key={c.id} c={c} onEdit={() => setEditing(c)} onDelete={() => remove(c.id)} />)}
        </div>
      </Card>

      {isAdmin ? (
        <Card className="p-6" hover={false}>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-white"><Lock className="h-5 w-5 text-nude" /> Panel Admin</h2>
          <p className="mb-4 text-xs text-[var(--muted)]">Accesos del equipo y plataformas compartidas — visible solo para vos.</p>
          <div className="space-y-2.5">
            {adminOnly.map((c) => <Row key={c.id} c={c} onEdit={() => setEditing(c)} onDelete={() => remove(c.id)} />)}
          </div>
        </Card>
      ) : (
        <Card className="flex items-center gap-3 border-dashed p-6" hover={false}>
          <Lock className="h-5 w-5 text-[var(--faint)]" />
          <p className="text-sm text-[var(--muted)]">El panel de credenciales del equipo está reservado al Admin.</p>
        </Card>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Editar acceso" : "Nuevo acceso"}
        description="Elegí si el identificador es un correo o un usuario. Lo que cargues se muestra al tocar el ojo."
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={save}>Guardar</Button></>}
      >
        {editing && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-20"><Field label="Ícono"><Input value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} className="text-center text-lg" /></Field></div>
              <div className="flex-1"><Field label="Plataforma"><Input value={editing.platform} onChange={(e) => setEditing({ ...editing, platform: e.target.value })} placeholder="Ej: Instagram" /></Field></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de identificador">
                <Select value={editing.idType} onChange={(e) => setEditing({ ...editing, idType: e.target.value as Cred["idType"] })}>
                  <option value="email">Correo</option>
                  <option value="usuario">Usuario</option>
                </Select>
              </Field>
              {isAdmin && (
                <Field label="Nivel">
                  <Select value={editing.scope} onChange={(e) => setEditing({ ...editing, scope: e.target.value as Cred["scope"] })}>
                    <option value="personal">Personal</option>
                    <option value="admin">Equipo (Admin)</option>
                  </Select>
                </Field>
              )}
            </div>
            <Field label={editing.idType === "email" ? "Correo" : "Usuario"}>
              <Input value={editing.identifier} onChange={(e) => setEditing({ ...editing, identifier: e.target.value })} placeholder={editing.idType === "email" ? "correo@ejemplo.com" : "@usuario"} />
            </Field>
            <Field label="Contraseña"><Input value={editing.secret} onChange={(e) => setEditing({ ...editing, secret: e.target.value })} placeholder="••••••••" /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
