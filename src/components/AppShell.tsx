"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogOut, ShieldCheck } from "lucide-react";
import { NAV, type Role } from "@/lib/brand";
import { signOut } from "@/app/login/actions";
import { LogoBadge } from "@/components/LogoBadge";
import { UserProvider } from "@/lib/user-context";

export interface ShellUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
}

export default function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = user.role === "admin";
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              active ? "text-white" : "text-[var(--muted)] hover:text-white"
            }`}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.07]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <Icon className={`relative z-10 h-[18px] w-[18px] shrink-0 ${active ? "text-nude" : ""}`} />
            <span className="relative z-10 font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const sidebarInner = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <LogoBadge size={46} />
        <div>
          <p className="font-display text-lg font-semibold leading-none text-white">ElaBela</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--faint)]">Marketing Platform</p>
        </div>
      </div>
      <div className="divider mx-4" />
      {nav}
      <div className="divider mx-4" />
      <div className="p-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-sm font-semibold text-white">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
            {isAdmin ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-nude">
                <ShieldCheck className="h-3 w-3" /> Admin
              </span>
            ) : (
              <span className="text-[11px] text-[var(--faint)]">@{user.username}</span>
            )}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="rounded-lg border border-white/10 p-2 text-[var(--muted)] transition hover:border-white/25 hover:text-white"
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
      <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col border-r border-white/8 lg:flex">
        {sidebarInner}
      </aside>

      <div className="glass sticky top-0 z-30 flex items-center justify-between border-b border-white/8 px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <LogoBadge size={34} />
          <span className="font-display text-base font-semibold text-white">ElaBela</span>
        </div>
        <button onClick={() => setOpen(true)} className="rounded-xl border border-white/10 p-2 text-white" aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="glass fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col lg:hidden"
            >
              <button onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded-lg p-1.5 text-[var(--muted)]" aria-label="Cerrar menú">
                <X className="h-5 w-5" />
              </button>
              {sidebarInner}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="lg:pl-[17rem]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
          <UserProvider user={user}>{children}</UserProvider>
        </div>
      </main>
    </div>
  );
}
