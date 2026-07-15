"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { ShieldCheck, KeyRound, CheckCircle2, UserRound, Users, Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader, Card, Button, Modal, Field, Input, Select } from "@/components/ui";
import { updatePassword } from "@/app/login/actions";
import { listProfiles, createProfile, updateProfile, deleteProfile, type ProfileRow } from "@/app/(app)/perfil/admin-actions";
import type { Role } from "@/lib/brand";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-60">
      <KeyRound className="h-4 w-4" />{pending ? "Guardando…" : "Actualizar contraseña"}
    </button>
  );
}

type Draft = { id: string; username: string; fullName: string; role: Role; password: string };
const emptyDraft = (): Draft => ({ id: "", username: "", fullName: "", role: "marketer", password: "" });

export default function PerfilView({ id, fullName, username, role }: { id: string; fullName: string; username: string; role: Role }) {
  const [state, action] = useActionState(updatePassword, undefined);
  const isAdmin = role === "admin";

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const refresh = () => { if (isAdmin) listProfiles().then(setProfiles).catch(() => {}); };
  useEffect(refresh, [isAdmin]);

  function save() {
    if (!draft) return;
    setErr(null);
    start(async () => {
      const res = draft.id
        ? await updateProfile({ id: draft.id, fullName: draft.fullName, role: draft.role, password: draft.password || undefined })
        : await createProfile({ username: draft.username, fullName: draft.fullName, role: draft.role, password: draft.password });
      if (res.error) { setErr(res.error); return; }
      setDraft(null);
      refresh();
    });
  }
  function remove(pid: string) {
    start(async () => { await deleteProfile(pid); refresh(); });
  }

  return (
    <div>
      <PageHeader eyebrow="Cuenta" title="Mi Perfil" description="Tus datos, seguridad y — si sos Admin — la gestión del equipo." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6" hover={false}>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-semibold text-white">{fullName.charAt(0).toUpperCase()}</div>
            <div>
              <h2 className="text-2xl font-semibold text-white">{fullName}</h2>
              <p className="text-sm text-[var(--muted)]">@{username}</p>
            </div>
          </div>
          <div className="divider my-5" />
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><dt className="flex items-center gap-2 text-[var(--muted)]"><UserRound className="h-4 w-4" /> Usuario</dt><dd className="text-white">{username}</dd></div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-[var(--muted)]"><ShieldCheck className="h-4 w-4" /> Rol</dt>
              <dd>{isAdmin ? <span className="inline-flex items-center gap-1 rounded-full border border-nude/30 bg-nude/10 px-2.5 py-1 text-xs text-nude"><ShieldCheck className="h-3 w-3" /> Administrador</span> : <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-[var(--muted)]">Marketer</span>}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6" hover={false}>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-white"><KeyRound className="h-5 w-5 text-nude" /> Cambiar contraseña</h2>
          <p className="mb-5 text-xs text-[var(--muted)]">Elegí una nueva contraseña de al menos 6 caracteres.</p>
          {state?.ok ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"><CheckCircle2 className="h-5 w-5" /> Contraseña actualizada.</motion.div>
          ) : (
            <form action={action} className="space-y-3">
              <input name="password" type="password" autoComplete="new-password" placeholder="Nueva contraseña" className="field" />
              <input name="confirm" type="password" autoComplete="new-password" placeholder="Repetir contraseña" className="field" />
              {state?.error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{state.error}</p>}
              <SaveButton />
            </form>
          )}
        </Card>
      </div>

      {isAdmin && (
        <Card className="mt-6 p-6" hover={false}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Users className="h-5 w-5 text-nude" /> Equipo</h2>
            <Button onClick={() => { setErr(null); setDraft(emptyDraft()); }}><Plus className="h-4 w-4" /> Nuevo perfil</Button>
          </div>
          <div className="space-y-2">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm font-semibold text-white">{(p.fullName || p.username).charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{p.fullName || p.username} {p.id === id && <span className="text-[11px] text-[var(--faint)]">(vos)</span>}</p>
                  <p className="text-[11px] text-[var(--faint)]">@{p.username}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] ${p.role === "admin" ? "border border-nude/30 bg-nude/10 text-nude" : "border border-white/10 text-[var(--muted)]"}`}>{p.role === "admin" ? "Admin" : "Marketer"}</span>
                <button onClick={() => { setErr(null); setDraft({ id: p.id, username: p.username, fullName: p.fullName, role: p.role, password: "" }); }} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] transition hover:text-white" aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></button>
                {p.id !== id && <button onClick={() => remove(p.id)} disabled={pending} className="rounded-lg border border-white/10 p-1.5 text-[var(--faint)] transition hover:text-red-300" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            ))}
            {profiles.length === 0 && <p className="py-6 text-center text-sm text-[var(--muted)]">Cargando equipo…</p>}
          </div>
        </Card>
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Editar perfil" : "Nuevo perfil"}
        description={draft?.id ? "El usuario no se puede cambiar. Dejá la contraseña vacía para no cambiarla." : "Se creará una cuenta con acceso inmediato."}
        footer={<><Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button><Button onClick={save} disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button></>}
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Usuario"><Input value={draft.username} disabled={!!draft.id} onChange={(e) => setDraft({ ...draft, username: e.target.value })} placeholder="ej: sofia" /></Field>
              <Field label="Rol"><Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}><option value="marketer">Marketer</option><option value="admin">Admin</option></Select></Field>
            </div>
            <Field label="Nombre completo"><Input value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} placeholder="Sofía Martínez" /></Field>
            <Field label={draft.id ? "Nueva contraseña (opcional)" : "Contraseña"}><Input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} placeholder="••••••••" /></Field>
            {err && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
