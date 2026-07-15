"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { NAV, type Role } from "@/lib/brand";
import { signOut } from "@/app/login/actions";

export interface ShellUser {
  username: string;
  fullName: string;
  role: Role;
}

export default function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = user.role === "admin";

  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
              active ? "text-cream" : "text-[var(--muted)] hover:text-cream"
            }`}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-2xl border border-terra/30 bg-gradient-to-r from-terra/20 to-transparent"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <Icon className="relative z-10 h-[18px] w-[18px] shrink-0" />
            <span className="relative z-10 font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const sidebarInner = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-terra to-chocolate shadow-glow-terra">
          <Sparkles className="h-5 w-5 text-cream" />
        </div>
        <div>
          <p className="font-display text-xl leading-none text-gradient">ElaBela</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Marketing Platform</p>
        </div>
      </div>
      <div className="divider-warm mx-4" />
      {nav}
      <div className="divider-warm mx-4" />
      <div className="p-4">
        <div className="glass flex items-center gap-3 rounded-2xl p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chocolate-500/40 text-sm font-semibold text-cream">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-cream">{user.fullName}</p>
            {isAdmin ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-terra">
                <ShieldCheck className="h-3 w-3" /> Admin
              </span>
            ) : (
              <span className="text-[11px] text-[var(--muted)]">@{user.username}</span>
            )}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] transition hover:border-terra/50 hover:text-cream"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen">
      {/* Desktop sidebar */}
      <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r lg:flex">
        {sidebarInner}
      </aside>

      {/* Mobile top bar */}
      <div className="glass sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-terra to-chocolate">
            <Sparkles className="h-4 w-4 text-cream" />
          </div>
          <span className="font-display text-lg text-gradient">ElaBela</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-xl border border-[var(--border)] p-2 text-cream"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="glass fixed inset-y-0 left-0 z-50 flex w-72 flex-col lg:hidden"
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute right-3 top-5 rounded-lg p-1.5 text-[var(--muted)]"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
              {sidebarInner}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Content */}
      <main className="lg:pl-72">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
