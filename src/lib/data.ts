/**
 * Seed data derived directly from the "CRM ElaBela" canvas.
 * Used to render every module fully populated before the Supabase tables are wired.
 */

export type TaskState = "todo" | "doing" | "done";

export interface DailyTask {
  id: string;
  name: string;
  icon: string;
  assignee: string; // profile username
  state: TaskState;
  note?: string;
}

/** Daily recurring tasks — from the "Tareas Diarias" group. */
export const DAILY_TASKS: DailyTask[] = [
  { id: "t1", name: "Crear portada de video", icon: "🎨", assignee: "cielo", state: "done" },
  { id: "t2", name: "Comunidad WhatsApp", icon: "👥", assignee: "elizabeth", state: "doing" },
  { id: "t3", name: "Crear video Avatar", icon: "🧑‍🎤", assignee: "cielo", state: "doing" },
  { id: "t4", name: "Crear Imágenes en Pedestal", icon: "🖼️", assignee: "elizabeth", state: "todo" },
  { id: "t5", name: "Editar Video", icon: "✂️", assignee: "cielo", state: "todo" },
  { id: "t6", name: "Subir Post IG", icon: "📤", assignee: "elizabeth", state: "todo" },
  { id: "t7", name: "Crear Tutorial / Carrusel", icon: "📚", assignee: "cielo", state: "todo" },
  { id: "t8", name: "Subir Post TikTok", icon: "📤", assignee: "elizabeth", state: "todo" },
  { id: "t9", name: "Chats - Redes", icon: "💬", assignee: "cielo", state: "doing" },
  { id: "t10", name: "Subir Post Facebook", icon: "📤", assignee: "elizabeth", state: "todo" },
  { id: "t11", name: "Publicar Historias (IG)", icon: "📲", assignee: "cielo", state: "doing", note: "Mín 2 / Máx 5 al día" },
  { id: "t12", name: "Crear Banner WEB", icon: "🖥️", assignee: "elizabeth", state: "todo" },
  { id: "t13", name: "Nutrición de Leads", icon: "🌱", assignee: "cielo", state: "todo" },
  { id: "t14", name: "Cambiar Banner WEB", icon: "🔄", assignee: "elizabeth", state: "todo" },
];

export interface PostType {
  id: string;
  name: string;
  icon: string;
  desc: string;
  accent: string;
}

/** Post catalogue — "Tipos de Post". */
export const POST_TYPES: PostType[] = [
  { id: "p1", name: "Video con IA", icon: "🤖", desc: "Generado íntegramente con IA", accent: "#c18468" },
  { id: "p2", name: "Video Híbrido", icon: "🎬", desc: "Grabación local + IA", accent: "#8b6357" },
  { id: "p3", name: "Carrusel", icon: "🎠", desc: "Secuencia de imágenes", accent: "#D6AB99" },
  { id: "p4", name: "Pedestal", icon: "🏛️", desc: "Producto en pedestal estético", accent: "#dbb09f" },
  { id: "p5", name: "Especial", icon: "🎉", desc: "Fecha festiva del calendario", accent: "#71453f" },
  { id: "p6", name: "Trends", icon: "🔥", desc: "Se copia un trend vigente", accent: "#dec2ad" },
];

export interface WeeklyReq {
  platform: string;
  format: string;
  freq: string;
  goal: string;
  progress: number; // 0..1
}

/** Requisitos Semanales de Publicación. */
export const WEEKLY_REQS: WeeklyReq[] = [
  { platform: "Instagram", format: "Reels", freq: "3-5 / semana", goal: "Alcance / Viralidad", progress: 0.8 },
  { platform: "Instagram", format: "Stories", freq: "2-5 / día", goal: "Fidelización / Venta", progress: 0.6 },
  { platform: "TikTok", format: "Video Corto", freq: "1-2 / día", goal: "Crecimiento rápido", progress: 1 },
  { platform: "Facebook", format: "Post / Video", freq: "3-4 / semana", goal: "Comunidad", progress: 0.5 },
];

export interface Project {
  id: string;
  name: string;
  owner: string;
  status: "todo" | "doing" | "done";
  due: string;
  steps: { label: string; done: boolean }[];
}

export const PROJECTS: Project[] = [
  {
    id: "pr1",
    name: "Relanzamiento línea Glow",
    owner: "cielo",
    status: "doing",
    due: "2026-07-28",
    steps: [
      { label: "Definir concepto visual", done: true },
      { label: "Sesión de fotos en pedestal", done: true },
      { label: "Editar carrusel + reel", done: false },
      { label: "Programar en calendario", done: false },
    ],
  },
  {
    id: "pr2",
    name: "Campaña Día del Amigo",
    owner: "elizabeth",
    status: "todo",
    due: "2026-07-30",
    steps: [
      { label: "Guion del video", done: false },
      { label: "Diseño de promo", done: false },
      { label: "Copy + hashtags", done: false },
    ],
  },
  {
    id: "pr3",
    name: "Renovación de Banners WEB",
    owner: "cielo",
    status: "done",
    due: "2026-07-10",
    steps: [
      { label: "Nuevos banners home", done: true },
      { label: "Publicar en tienda", done: true },
    ],
  },
];

export interface Product {
  code: string;
  name: string;
  brand: string;
  category: string;
  durationDays: number;
}

export const PRODUCTS: Product[] = [
  { code: "EL-001", name: "Sérum Vitamina C", brand: "Elaluz", category: "Skincare", durationDays: 45 },
  { code: "TA-014", name: "Blush Cremoso", brand: "Tarte", category: "Maquillaje", durationDays: 120 },
  { code: "EL-007", name: "Protector Solar FPS50", brand: "Elaluz", category: "Skincare", durationDays: 60 },
  { code: "GL-021", name: "Lip Glow Bálsamo", brand: "Glow", category: "Labios", durationDays: 90 },
];

export interface Client {
  id: string;
  name: string;
  whatsapp: string;
  main: "Instagram" | "TikTok" | "Facebook" | "WhatsApp";
  bought: boolean;
  lastPurchase?: string;
  nextContact?: string;
}

export const CLIENTS: Client[] = [
  { id: "c1", name: "Sofía Martínez", whatsapp: "0981 111 222", main: "Instagram", bought: true, lastPurchase: "2026-06-10", nextContact: "2026-07-25" },
  { id: "c2", name: "Lucía Benítez", whatsapp: "0971 333 444", main: "TikTok", bought: false },
  { id: "c3", name: "Camila Rojas", whatsapp: "0985 555 666", main: "WhatsApp", bought: true, lastPurchase: "2026-05-02", nextContact: "2026-07-20" },
  { id: "c4", name: "Valentina Ortiz", whatsapp: "0961 777 888", main: "Facebook", bought: false },
];

export interface Guion {
  id: string;
  name: string;
  state: "falta" | "editando" | "listo";
  product: string;
  brand: string;
  record: string;
  publish: string;
  responsible: string;
  types: string[];
}

export const GUIONES: Guion[] = [
  { id: "g1", name: "Rutina noche Glow", state: "listo", product: "Sérum Vitamina C", brand: "Elaluz", record: "2026-07-12", publish: "2026-07-16", responsible: "cielo", types: ["Video Híbrido"] },
  { id: "g2", name: "Unboxing Blush", state: "editando", product: "Blush Cremoso", brand: "Tarte", record: "2026-07-14", publish: "2026-07-18", responsible: "elizabeth", types: ["Carrusel", "Trends"] },
  { id: "g3", name: "Tip protección solar", state: "falta", product: "Protector Solar FPS50", brand: "Elaluz", record: "2026-07-20", publish: "2026-07-22", responsible: "cielo", types: ["Video con IA"] },
];

export interface SpecialDate {
  date: string; // ISO
  label: string;
  emoji: string;
  kind: "festivo" | "marketing";
}

/** Fechas especiales de Paraguay + hitos de marketing (para el calendario). */
export const SPECIAL_DATES: SpecialDate[] = [
  { date: "2026-07-30", label: "Día del Amigo", emoji: "🤝", kind: "marketing" },
  { date: "2026-08-15", label: "Fundación de Asunción", emoji: "🏛️", kind: "festivo" },
  { date: "2026-09-29", label: "Batalla de Boquerón", emoji: "🎖️", kind: "festivo" },
  { date: "2026-12-08", label: "Virgen de Caacupé", emoji: "⛪", kind: "festivo" },
  { date: "2026-12-25", label: "Navidad", emoji: "🎄", kind: "festivo" },
];

export interface ToolCategory {
  id: string;
  title: string;
  emoji: string;
  desc: string;
  items: { label: string; href?: string; note?: string }[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: "prompts",
    title: "Prompts",
    emoji: "💬",
    desc: "Prompts listos para copiar",
    items: [
      { label: "Hook viral para Reels", note: "Genera 5 hooks en 3s" },
      { label: "Copy de venta suave", note: "Tono cercano, foco beneficio" },
    ],
  },
  {
    id: "gems",
    title: "GEMS de Gemini",
    emoji: "💎",
    desc: "Enlaces a cada GEM",
    items: [{ label: "GEM · Content Studio", note: "Estética de marca" }],
  },
  {
    id: "apps",
    title: "Apps",
    emoji: "📲",
    desc: "Herramientas externas",
    items: [
      { label: "Extractor de Metadatos de Imagen", href: "https://extractor-meta-datos-img.vercel.app/" },
      { label: "Content Studio IA", href: "https://content-studio-ia.vercel.app/" },
    ],
  },
  {
    id: "ia",
    title: "IA",
    emoji: "🤖",
    desc: "Herramientas de IA del equipo",
    items: [{ label: "Gemini", href: "https://gemini.google.com" }],
  },
  {
    id: "ads",
    title: "Ads",
    emoji: "📢",
    desc: "Plataformas publicitarias",
    items: [
      { label: "Google Merchant Center", href: "https://merchants.google.com" },
      { label: "TikTok Ads", href: "https://ads.tiktok.com" },
      { label: "Meta Ads", href: "https://business.facebook.com" },
    ],
  },
  {
    id: "links",
    title: "Enlaces Oficiales",
    emoji: "🔗",
    desc: "Redes y sitio de ElaBela",
    items: [
      { label: "Linktree", href: "https://links.elabela.com.py/" },
      { label: "Instagram @elabela.glow", href: "https://www.instagram.com/elabela.glow/" },
      { label: "Facebook · ElaBela Glow", href: "https://www.facebook.com/people/ElaBela-Glow/61573675747127/" },
      { label: "TikTok @elabela.glow", href: "https://www.tiktok.com/@elabela.glow" },
    ],
  },
];

/** Platforms tracked in the credentials vault (values are never stored in the repo). */
export const CREDENTIAL_PLATFORMS = [
  { platform: "Instagram", icon: "📸", scope: "personal" },
  { platform: "Facebook", icon: "📘", scope: "personal" },
  { platform: "TikTok", icon: "🎵", scope: "personal" },
  { platform: "WhatsApp Business", icon: "💬", scope: "personal" },
  { platform: "Later.com", icon: "📅", scope: "admin" },
  { platform: "Metricool", icon: "📊", scope: "admin" },
  { platform: "Relatorios (Catálogo)", icon: "📦", scope: "admin" },
] as const;
