"use client";

import { useState } from "react";
import { Eye, EyeOff, ShieldCheck, Lock, Plus, Copy } from "lucide-react";
import { PageHeader, Card, Reveal } from "@/components/ui";
import { CREDENTIAL_PLATFORMS } from "@/lib/data";
import type { Role } from "@/lib/brand";

function Row({ icon, platform }: { icon: string; platform: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-black/15 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="text-sm text-cream">{platform}</p>
          <p className="font-mono text-xs text-[var(--muted)]">
            {show ? "— sin configurar —" : "••••••••••"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => setShow((s) => !s)} className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)] transition hover:text-cream" aria-label="Mostrar">
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)] transition hover:text-cream" aria-label="Copiar">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function CredencialesView({ role }: { role: Role }) {
  const isAdmin = role === "admin";
  const personal = CREDENTIAL_PLATFORMS.filter((c) => c.scope === "personal");
  const adminOnly = CREDENTIAL_PLATFORMS.filter((c) => c.scope === "admin");

  return (
    <div>
      <PageHeader
        eyebrow="Seguridad"
        title="Credenciales"
        description="Gestor de accesos por niveles. Cada perfil guarda sus credenciales personales; solo el Admin ve las del equipo."
        action={
          <button className="flex items-center gap-2 rounded-2xl border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted)] transition hover:border-terra/50 hover:text-cream">
            <Plus className="h-4 w-4" /> Agregar acceso
          </button>
        }
      />

      <Card className="mb-6 flex items-start gap-3 border-amber-400/20 bg-amber-400/5 p-4" hover={false}>
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <p className="text-xs text-amber-200/90">
          Por seguridad, los valores reales se guardan <strong>encriptados en reposo</strong> y nunca en el repositorio.
          Este panel es el contenedor: configurá cada acceso desde aquí.
        </p>
      </Card>

      <Reveal>
        <Card className="mb-6 p-6" hover={false}>
          <h2 className="mb-4 flex items-center gap-2 text-lg text-cream">
            <ShieldCheck className="h-5 w-5 text-terra" /> Mis credenciales
          </h2>
          <div className="space-y-2.5">
            {personal.map((c) => (
              <Row key={c.platform} icon={c.icon} platform={c.platform} />
            ))}
          </div>
        </Card>
      </Reveal>

      {isAdmin ? (
        <Reveal delay={0.05}>
          <Card className="p-6" hover={false}>
            <h2 className="mb-1 flex items-center gap-2 text-lg text-cream">
              <Lock className="h-5 w-5 text-terra" /> Panel Admin
            </h2>
            <p className="mb-4 text-xs text-[var(--muted)]">Accesos del equipo y plataformas compartidas — visible solo para vos.</p>
            <div className="space-y-2.5">
              {adminOnly.map((c) => (
                <Row key={c.platform} icon={c.icon} platform={c.platform} />
              ))}
            </div>
          </Card>
        </Reveal>
      ) : (
        <Card className="flex items-center gap-3 border-dashed p-6" hover={false}>
          <Lock className="h-5 w-5 text-[var(--muted)]" />
          <p className="text-sm text-[var(--muted)]">El panel de credenciales del equipo está reservado al Admin.</p>
        </Card>
      )}
    </div>
  );
}
