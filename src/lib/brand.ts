import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CalendarDays,
  ListChecks,
  FolderKanban,
  Megaphone,
  Clapperboard,
  Users,
  Wrench,
  Palette,
  KeyRound,
  UserRound,
} from "lucide-react";

/** Official ElaBela brand palette — from the "Manual de Marca" node in the CRM canvas. */
export const BRAND_COLORS = [
  { name: "Chocolate", role: "Primario", hex: "#71453f" },
  { name: "Nude Glow", role: "Secundario", hex: "#D6AB99" },
  { name: "Cream", role: "Texto s/ botones oscuros", hex: "#fcebdb" },
  { name: "Light Nude", role: "Apoyo", hex: "#dec2ad" },
  { name: "Rose Nude", role: "Apoyo", hex: "#dbb09f" },
  { name: "Terra", role: "Acento", hex: "#c18468" },
  { name: "Brown", role: "Apoyo", hex: "#8b6357" },
] as const;

export type Role = "admin" | "marketer";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  desc: string;
  adminOnly?: boolean;
}

/** Main navigation — mirrors the module map in the canvas, top-to-bottom flow. */
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Panel Principal", icon: LayoutDashboard, desc: "Resumen del día" },
  { href: "/calendario", label: "Calendario", icon: CalendarDays, desc: "Programación y fechas especiales" },
  { href: "/tareas", label: "Tareas Diarias", icon: ListChecks, desc: "Tareas recurrentes por perfil" },
  { href: "/publicaciones", label: "Publicaciones", icon: Megaphone, desc: "Tipos de post y requisitos" },
  { href: "/guiones", label: "Guiones", icon: Clapperboard, desc: "Planificación de videos" },
  { href: "/proyectos", label: "Proyectos", icon: FolderKanban, desc: "Iniciativas y checklists" },
  { href: "/hub", label: "HUB Clientes", icon: Users, desc: "Clientes y productos" },
  { href: "/tools", label: "Tools", icon: Wrench, desc: "Recursos y prompts" },
  { href: "/marca", label: "Manual de Marca", icon: Palette, desc: "Colores y tipografías" },
  { href: "/credenciales", label: "Credenciales", icon: KeyRound, desc: "Accesos por nivel", adminOnly: false },
  { href: "/perfil", label: "Mi Perfil", icon: UserRound, desc: "Cuenta y contraseña" },
];

export const APP_NAME = "ElaBela";
export const APP_TAGLINE = "Marketing & Growth Platform";
