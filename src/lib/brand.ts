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

export type BrandFontFormat = "woff2" | "woff" | "ttf" | "otf";

const BRAND_FONT_FORMATS = new Set<BrandFontFormat>(["woff2", "woff", "ttf", "otf"]);
const CSS_FONT_FORMAT: Record<BrandFontFormat, string> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
};

export function fontFormatFromFileName(name: string): BrandFontFormat | null {
  const extension = name.split(".").pop()?.toLowerCase() as BrandFontFormat | undefined;
  return extension && BRAND_FONT_FORMATS.has(extension) ? extension : null;
}

function stableFontHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function brandFontFamily(id: string) {
  const scopedId = id.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "font";
  return `ElaBelaBrand-${scopedId}-${stableFontHash(id)}`;
}

function escapeCssString(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\"/g, '\\\"')
    .replace(/\r/g, "\\d ")
    .replace(/\n/g, "\\a ")
    .replace(/\f/g, "\\c ");
}

export function brandFontFaceRule(asset: { id: string; fileUrl?: string; fileFormat?: string }) {
  if (!asset.fileUrl || !asset.fileFormat || !BRAND_FONT_FORMATS.has(asset.fileFormat as BrandFontFormat)) return null;
  const format = asset.fileFormat as BrandFontFormat;
  return `@font-face { font-family: "${brandFontFamily(asset.id)}"; src: url("${escapeCssString(asset.fileUrl)}") format("${CSS_FONT_FORMAT[format]}"); font-display: swap; }`;
}

export function storagePathFromPublicUrl(url: string) {
  const marker = "/storage/v1/object/public/elabela-assets/";
  const parsed = new URL(url);
  const markerIndex = parsed.pathname.indexOf(marker);
  return markerIndex === -1 ? "" : decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
}
