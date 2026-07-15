"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { ShieldCheck, KeyRound, CheckCircle2, UserRound } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { updatePassword } from "@/app/login/actions";
import type { Role } from "@/lib/brand";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-60">
      <KeyRound className="h-4 w-4" />{pending ? "Guardando…" : "Actualizar contraseña"}
    </button>
  );
}

export default function PerfilView({ fullName, username, role }: { fullName: string; username: string; role: Role }) {
  const [state, action] = useActionState(updatePassword, undefined);
  const isAdmin = role === "admin";

  return (
    <div>
      <PageHeader eyebrow="Cuenta" title="Mi Perfil" description="Tus datos y seguridad." />
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
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-[var(--muted)]"><UserRound className="h-4 w-4" /> Usuario</dt>
              <dd className="text-white">{username}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-[var(--muted)]"><ShieldCheck className="h-4 w-4" /> Rol</dt>
              <dd>
                {isAdmin
                  ? <span className="inline-flex items-center gap-1 rounded-full border border-nude/30 bg-nude/10 px-2.5 py-1 text-xs text-nude"><ShieldCheck className="h-3 w-3" /> Administrador</span>
                  : <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-[var(--muted)]">Marketer</span>}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6" hover={false}>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-white"><KeyRound className="h-5 w-5 text-nude" /> Cambiar contraseña</h2>
          <p className="mb-5 text-xs text-[var(--muted)]">Elegí una nueva contraseña de al menos 6 caracteres.</p>
          {state?.ok ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              <CheckCircle2 className="h-5 w-5" /> Contraseña actualizada correctamente.
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
      </div>
    </div>
  );
}
