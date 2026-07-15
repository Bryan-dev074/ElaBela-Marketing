"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";
import { User, Lock, ArrowRight, Sparkles } from "lucide-react";
import { signIn } from "@/app/login/actions";

const QUICK_USERS = ["bryan", "cielo", "elizabeth"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-terra to-chocolate px-5 py-3.5 text-sm font-semibold text-cream shadow-glow-terra transition-all hover:shadow-glow-terra hover:brightness-110 disabled:opacity-60"
    >
      {pending ? "Ingresando…" : "Ingresar"}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(signIn, undefined);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="glass w-full max-w-md rounded-3xl p-8 sm:p-10"
    >
      <div className="mb-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-terra to-chocolate shadow-glow-terra">
          <Sparkles className="h-7 w-7 text-cream" />
        </div>
        <p className="eyebrow mb-2">Marketing & Growth</p>
        <h1 className="text-4xl text-gradient">ElaBela</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Ingresá a tu panel de trabajo
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Usuario</span>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              name="username"
              autoComplete="username"
              placeholder="tu usuario"
              className="w-full rounded-2xl border border-[var(--border)] bg-black/20 py-3 pl-10 pr-3 text-sm text-[var(--text)] outline-none transition focus:border-terra/60 focus:bg-black/30"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Contraseña</span>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-2xl border border-[var(--border)] bg-black/20 py-3 pl-10 pr-3 text-sm text-[var(--text)] outline-none transition focus:border-terra/60 focus:bg-black/30"
            />
          </div>
        </label>

        {state?.error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {state.error}
          </p>
        )}

        <SubmitButton />
      </form>

      <div className="mt-7">
        <div className="divider-warm mb-4" />
        <p className="mb-2 text-center text-[11px] uppercase tracking-widest text-[var(--muted)]">
          Acceso rápido
        </p>
        <div className="flex justify-center gap-2">
          {QUICK_USERS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={(e) => {
                const form = (e.currentTarget.closest("div.glass") as HTMLElement)?.querySelector(
                  'input[name="username"]',
                ) as HTMLInputElement | null;
                if (form) {
                  form.value = u;
                  form.focus();
                }
              }}
              className="rounded-full border border-[var(--border)] bg-black/20 px-3.5 py-1.5 text-xs capitalize text-[var(--muted)] transition hover:border-terra/50 hover:text-cream"
            >
              {u}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
