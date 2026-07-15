"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { User, Lock, ArrowRight } from "lucide-react";
import { signIn } from "@/app/login/actions";
import { LogoBadge } from "@/components/LogoBadge";

const QUICK_USERS = ["bryan", "cielo", "elizabeth"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-black shadow-[0_10px_40px_-10px_rgba(255,255,255,0.4)] transition hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? "Ingresando…" : "Ingresar"}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(signIn, undefined);
  const [username, setUsername] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="glass w-full max-w-md rounded-3xl p-8 shadow-pop sm:p-10"
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <LogoBadge size={60} />
        <p className="eyebrow mb-2 mt-5">Marketing & Growth</p>
        <h1 className="text-4xl font-semibold text-gradient">ElaBela</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Ingresá a tu panel de trabajo</p>
      </div>

      <form action={formAction} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Usuario</span>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" />
            <input
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="tu usuario"
              className="field pl-10"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Contraseña</span>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" />
            <input name="password" type="password" autoComplete="current-password" placeholder="••••••••" className="field pl-10" />
          </div>
        </label>

        {state?.error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{state.error}</p>
        )}

        <SubmitButton />
      </form>

      <div className="mt-7">
        <div className="divider mb-4" />
        <p className="mb-2.5 text-center text-[11px] uppercase tracking-widest text-[var(--faint)]">Acceso rápido</p>
        <div className="flex justify-center gap-2">
          {QUICK_USERS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUsername(u)}
              className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs capitalize text-[var(--muted)] transition hover:border-white/25 hover:text-white"
            >
              {u}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
