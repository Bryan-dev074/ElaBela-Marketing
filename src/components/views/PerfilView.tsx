"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, KeyRound, CheckCircle2, UserRound, Users, Plus, Pencil, Trash2, Camera, Loader2 } from "lucide-react";
import { PageHeader, Card, Button, Modal, Field, Input, Select, Reveal } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { useProfiles, fileToAvatar } from "@/lib/profiles";
import { updatePassword } from "@/app/login/actions";
import { listProfiles, createProfile, updateProfile, deleteProfile, type ProfileRow } from "@/app/(app)/perfil/admin-actions";
import type { Role } from "@/lib/brand";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="press flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-[0_8px_30px_-8px_rgba(255,255,255,0.35)] transition hover:bg-zinc-200 disabled:opacity-60">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
      {pending ? "Guardando…" : "Actualizar contraseña"}
    </button>
  );
}

function RoleChip({ role, full = false }: { role: Role; full?: boolean }) {
  if (role === "admin") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-nude/30 bg-nude/10 px-2.5 py-1 text-[11px]">
        <ShieldCheck className="h-3 w-3 text-nude" />
        <span className="glow-text font-semibold">{full ? "Administrador" : "Admin"}</span>
      </span>
    );
  }
  return <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[var(--muted)]">Marketer</span>;
}

/** Foto de perfil grande con overlay «Cambiar foto», subida con fileToAvatar y opción de quitar. */
function ProfilePhoto({ id, username }: { id: string; username: string }) {
  const { byUsername, setAvatar } = useProfiles();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPhoto = !!byUsername(username)?.avatar;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToAvatar(file);
      await setAvatar(id, dataUrl);
    } catch {
      setError("No pudimos leer esa imagen. Probá con otro archivo.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setError(null);
    setBusy(true);
    try {
      await setAvatar(id, "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-[96px] shrink-0 flex-col items-center gap-1.5">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <button
        type="button"
        onClick={() => !busy && inputRef.current?.click()}
        disabled={busy}
        aria-label="Cambiar foto de perfil"
        data-cursor-color="#d6ab99"
        data-cursor-label="Cambiar foto"
        className="press group relative rounded-full"
      >
        <Avatar username={username} size={84} ring />
        <span
          className={`absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-full bg-black/65 backdrop-blur-[2px] transition-opacity duration-200 ${
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-nude" />
          ) : (
            <>
              <Camera className="h-5 w-5 text-nude" />
              <span className="text-[9px] font-medium text-white/90">Cambiar foto</span>
            </>
          )}
        </span>
      </button>
      {hasPhoto && !busy && (
        <button
          type="button"
          onClick={removePhoto}
          data-cursor-color="#f87171"
          data-cursor-label="Quitar"
          className="text-[11px] text-[var(--faint)] transition hover:text-red-300"
        >
          Quitar foto
        </button>
      )}
      {error && <p className="text-center text-[10px] leading-tight text-red-300">{error}</p>}
    </div>
  );
}

/** Avatar de una fila del equipo: al hover muestra la cámara y permite cambiarle la foto a ese perfil. */
function RowAvatarButton({ pid, username, onError }: { pid: string; username: string; onError: (msg: string) => void }) {
  const { setAvatar } = useProfiles();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await setAvatar(pid, await fileToAvatar(file));
    } catch {
      onError(`No pudimos actualizar la foto de @${username}. Probá con otra imagen.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <button
        type="button"
        onClick={() => !busy && inputRef.current?.click()}
        aria-label={`Cambiar foto de @${username}`}
        data-cursor-color="#d6ab99"
        data-cursor-label="Cambiar foto"
        className="press group relative shrink-0 rounded-full"
      >
        <Avatar username={username} size={38} />
        <span
          className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/65 transition-opacity duration-200 ${
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
          }`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-nude" /> : <Camera className="h-3.5 w-3.5 text-nude" />}
        </span>
      </button>
    </>
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
  const [teamErr, setTeamErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const refresh = () => { if (isAdmin) listProfiles().then(setProfiles).catch(() => {}); };
  useEffect(refresh, [isAdmin]);

  useEffect(() => {
    if (!confirmDel) return;
    const t = setTimeout(() => setConfirmDel(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDel]);

  useEffect(() => {
    if (!teamErr) return;
    const t = setTimeout(() => setTeamErr(null), 6000);
    return () => clearTimeout(t);
  }, [teamErr]);

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
    start(async () => {
      const res = await deleteProfile(pid);
      if (res.error) setTeamErr(res.error);
      refresh();
    });
  }

  return (
    <div>
      <PageHeader eyebrow="Cuenta" title="Mi Perfil" description="Tu foto, tus datos, tu seguridad — y si sos Admin, la gestión del equipo." />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* -------- Identidad: punto focal -------- */}
        <Reveal>
          <Card className="ring-glow h-full p-6" hover={false}>
            <div className="flex items-center gap-5">
              <ProfilePhoto id={id} username={username} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-2xl font-semibold text-white">{fullName}</h2>
                <p className="glow-text mt-0.5 inline-block text-sm font-semibold">@{username}</p>
              </div>
            </div>
            <div className="divider my-5" />
            <dl className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-[var(--muted)]"><UserRound className="h-4 w-4" /> Usuario</dt>
                <dd className="truncate text-white">{username}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-[var(--muted)]"><ShieldCheck className="h-4 w-4" /> Rol</dt>
                <dd><RoleChip role={role} full /></dd>
              </div>
            </dl>
            <p className="mt-5 text-[11px] leading-relaxed text-[var(--faint)]">
              Tocá tu foto para cambiarla — se actualiza al instante en el sidebar y en toda la app.
            </p>
          </Card>
        </Reveal>

        {/* -------- Contraseña -------- */}
        <Reveal delay={0.06}>
          <Card className="card-sheen h-full p-6" hover={false}>
            <div className="mb-5 flex items-center gap-3">
              <span className="glow-pulse flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-nude/10 text-nude"><KeyRound className="h-4 w-4" /></span>
              <div>
                <h2 className="text-lg font-semibold text-white">Cambiar contraseña</h2>
                <p className="text-xs text-[var(--muted)]">Elegí una nueva de al menos 6 caracteres.</p>
              </div>
            </div>
            {state?.ok ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                <CheckCircle2 className="h-5 w-5" /> Contraseña actualizada.
              </motion.div>
            ) : (
              <form action={action} className="space-y-3">
                <input name="password" type="password" autoComplete="new-password" placeholder="Nueva contraseña" className="field" />
                <input name="confirm" type="password" autoComplete="new-password" placeholder="Repetir contraseña" className="field" />
                {state?.error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{state.error}</p>}
                <SaveButton />
              </form>
            )}
          </Card>
        </Reveal>
      </div>

      {/* -------- Equipo (solo Admin) -------- */}
      {isAdmin && (
        <Reveal delay={0.12} className="mt-6">
          <Card className="p-6" hover={false}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Users className="h-5 w-5 text-nude" /> Equipo
                  {profiles.length > 0 && <span className="num rounded-full border border-nude/25 bg-nude/10 px-2 py-0.5 text-[11px] font-semibold text-nude">{profiles.length}</span>}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">Creá cuentas, editá roles y cambiá la foto de cualquiera con la cámara.</p>
              </div>
              <Button onClick={() => { setErr(null); setDraft(emptyDraft()); }}><Plus className="h-4 w-4" /> Nuevo perfil</Button>
            </div>

            <AnimatePresence>
              {teamErr && (
                <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {teamErr}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <AnimatePresence>
                {profiles.map((p, i) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 } }}
                    exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3 transition-colors duration-200 hover:border-nude/25 hover:bg-white/[0.04]"
                  >
                    <RowAvatarButton pid={p.id} username={p.username} onError={setTeamErr} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {p.fullName || p.username}
                        {p.id === id && <span className="ml-1.5 text-[11px] font-normal text-[var(--faint)]">(vos)</span>}
                      </p>
                      <p className="truncate text-[11px] text-[var(--faint)]">@{p.username}</p>
                    </div>
                    <RoleChip role={p.role} />
                    <button
                      onClick={() => { setErr(null); setDraft({ id: p.id, username: p.username, fullName: p.fullName, role: p.role, password: "" }); }}
                      className="press flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[var(--faint)] transition hover:border-white/25 hover:text-white"
                      aria-label={`Editar a @${p.username}`}
                      data-cursor-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {p.id !== id && (
                      confirmDel === p.id ? (
                        <button
                          onClick={() => { setConfirmDel(null); remove(p.id); }}
                          disabled={pending}
                          className="press h-9 shrink-0 rounded-lg border border-red-400/40 bg-red-500/15 px-2.5 text-[11px] font-semibold text-red-300 disabled:opacity-50"
                          data-cursor-color="#f87171"
                          data-cursor-label="Confirmar"
                        >
                          ¿Seguro?
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDel(p.id)}
                          className="press flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[var(--faint)] transition hover:border-red-400/30 hover:text-red-300"
                          aria-label={`Eliminar a @${p.username}`}
                          data-cursor-color="#f87171"
                          data-cursor-label="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {profiles.length === 0 && (
                <div className="space-y-2" aria-label="Cargando equipo">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-[62px] animate-pulse rounded-xl border border-white/5 bg-white/[0.03]" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              )}
            </div>
          </Card>
        </Reveal>
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
            {draft.id && (
              <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                <Avatar username={draft.username} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{draft.fullName || draft.username}</p>
                  <p className="text-[11px] text-[var(--faint)]">La foto se cambia desde la lista, con el botón de cámara.</p>
                </div>
              </div>
            )}
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
