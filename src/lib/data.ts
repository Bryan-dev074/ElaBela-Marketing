/**
 * Seed data derived directly from the "CRM ElaBela" canvas.
 * Used to render every module fully populated before the Supabase tables are wired.
 */

export type TaskState = "todo" | "doing" | "done";

export interface DailyTask {
  id: string;
  name: string;
  icon: string;
  assignee: string; // profile username assigned TODAY
  state: TaskState;
  note?: string;
  /** If present with 2+ users, the task rotates among them day by day; otherwise it's fixed to `assignee`. */
  rotation?: string[];
  /** Days of the week the task applies to (0 = Lunes … 6 = Domingo). Empty/absent = every day. */
  days?: number[];
  /**
   * Modo «fija por día»: 7 posiciones (0 = Lunes … 6 = Domingo) con el username
   * dueño de la tarea ese día ("" = ese día no se hace). Ej: Lun/Mié cielo,
   * Mar/Jue elizabeth. Si está presente, manda sobre `days` y `rotation`.
   */
  dayAssignees?: string[];
  /** Id del tipo de post al que se refiere la tarea (opcional; catálogo de Publicaciones). */
  postType?: string;
}

/**
 * Tarea SEMANAL: como un proyecto chico — vive en una bolsa sin fecha y se
 * arrastra al calendario para agendarla un día con su responsable. Puede
 * hacerse una vez a la semana o no hacerse. Las tareas diarias se pueden
 * convertir en semanales.
 */
export interface WeeklyTask {
  id: string;
  name: string;
  icon: string;
  assignee: string;
  /** Fecha agendada en el calendario (ausente = sin agendar). */
  date?: string;
  state: TaskState;
  /** Id del tipo de post (opcional). */
  postType?: string;
  createdAt: string;
}

/** Whether the task uses per-day fixed owners (modo «Por día»). */
export const taskIsPerDay = (t: DailyTask) => !!t.dayAssignees && t.dayAssignees.some(Boolean);

/** Weekday labels, Monday-first (matches the `days` indices of DailyTask). */
export const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

/** Today's Monday-first weekday index (0 = Lunes … 6 = Domingo). */
export const todayWeekday = () => (new Date().getDay() + 6) % 7;

/** Whether a daily task is scheduled for today (no `days` = every day). */
export const taskAppliesToday = (t: DailyTask) => {
  if (taskIsPerDay(t)) return !!t.dayAssignees![todayWeekday()];
  return !t.days || t.days.length === 0 || t.days.includes(todayWeekday());
};

/** Day of the year (1 = 1 de enero), via UTC so the rotation is deterministic. */
export const dayOfYear = (d = new Date()) =>
  Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 86400000) + 1;

/** Epoch fijo para la rotación (lunes 1 de enero de 2024) — determinístico entre sesiones. */
const ROTATION_EPOCH_UTC = Date.UTC(2024, 0, 1);

/**
 * Who the task belongs to TODAY. Rotating tasks advance one member per each
 * day the task APPLIES (its `days` selection): a Lun·Mié·Vie task hands off
 * only on those days. Tasks without `days` rotate every day; fixed tasks
 * return their `assignee`.
 */
/**
 * Whether the task belongs to this member. A rotating task belongs to EVERY
 * member of the rotation (whoever is free can cover it); a per-day task
 * belongs to whoever owns at least one day; the daily priority
 * («a quién le toca hoy») is `taskAssigneeToday`.
 */
export const taskBelongsTo = (t: DailyTask, username: string) => {
  if (taskIsPerDay(t)) return t.dayAssignees!.includes(username);
  return t.rotation && t.rotation.length > 1 ? t.rotation.includes(username) : t.assignee === username;
};

/**
 * Whether the task counts as MINE today. Rotating tasks are shared (every
 * member sees them today, with a turn chip); per-day tasks are FIXED to the
 * day's owner; fixed tasks require being the assignee.
 */
export const taskMineToday = (t: DailyTask, username: string) => {
  if (!taskAppliesToday(t)) return false;
  if (taskIsPerDay(t)) return t.dayAssignees![todayWeekday()] === username;
  return taskBelongsTo(t, username);
};

export const taskAssigneeToday = (t: DailyTask, date = new Date()) => {
  if (taskIsPerDay(t)) {
    const wd = (date.getDay() + 6) % 7;
    return t.dayAssignees![wd] || t.assignee;
  }
  if (!t.rotation || t.rotation.length < 2) return t.assignee;
  const diff = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - ROTATION_EPOCH_UTC) / 86400000);
  if (!t.days || t.days.length === 0 || t.days.length === 7) return t.rotation[((diff % t.rotation.length) + t.rotation.length) % t.rotation.length];
  // Cantidad de días aplicables transcurridos ANTES de hoy (el epoch es lunes,
  // así que weekday(offset) === offset % 7 con índice lunes-primero).
  const fullWeeks = Math.floor(diff / 7);
  const rem = diff % 7;
  let count = fullWeeks * t.days.length;
  for (const d of t.days) if (d < rem) count++;
  return t.rotation[count % t.rotation.length];
};

/** Fecha corta es-PY («16 jul.») desde una fecha ISO yyyy-mm-dd. */
export const fmtShortDate = (d?: string) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("es-PY", { day: "numeric", month: "short" }) : null;

/** Daily recurring tasks — from the "Tareas Diarias" group. */
export const DAILY_TASKS: DailyTask[] = [
  { id: "t1", name: "Crear portada de video", icon: "🎨", assignee: "bryan", state: "done" },
  { id: "t2", name: "Comunidad WhatsApp", icon: "👥", assignee: "elizabeth", state: "doing" },
  { id: "t3", name: "Crear video Avatar", icon: "🧑‍🎤", assignee: "cielo", state: "doing" },
  { id: "t4", name: "Crear Imágenes en Pedestal", icon: "🖼️", assignee: "elizabeth", state: "todo" },
  { id: "t5", name: "Editar Video", icon: "✂️", assignee: "cielo", state: "todo" },
  { id: "t6", name: "Subir Post IG", icon: "📤", assignee: "elizabeth", state: "todo" },
  { id: "t7", name: "Crear Tutorial / Carrusel", icon: "📚", assignee: "cielo", state: "todo" },
  { id: "t8", name: "Subir Post TikTok", icon: "📤", assignee: "elizabeth", state: "todo" },
  { id: "t9", name: "Chats - Redes", icon: "💬", assignee: "bryan", state: "doing" },
  { id: "t10", name: "Subir Post Facebook", icon: "📤", assignee: "elizabeth", state: "todo" },
  { id: "t11", name: "Publicar Historias", icon: "📲", assignee: "cielo", state: "doing", note: "Ver panel de historias", rotation: ["cielo", "elizabeth"] },
  { id: "t12", name: "Crear Banner WEB", icon: "🖥️", assignee: "elizabeth", state: "todo" },
  { id: "t13", name: "Nutrición de Leads", icon: "🌱", assignee: "bryan", state: "todo" },
  { id: "t14", name: "Cambiar Banner WEB", icon: "🔄", assignee: "elizabeth", state: "todo" },
];

export interface PostType {
  id: string;
  name: string;
  icon: string;
  desc: string;
  accent: string;
  example?: string;
  exampleImage?: string; // URL legacy de la primera imagen, para compatibilidad
  exampleImages: string[];
  guide: string;
  toolIds: string[];
}

/** Post catalogue — "Tipos de Post". */
export const POST_TYPES: PostType[] = [
  { id: "p1", name: "Video con IA", icon: "🤖", desc: "Generado íntegramente con IA", accent: "#818cf8", example: "Avatar presentando el producto con voz IA + b-roll generado.", exampleImages: [], guide: "", toolIds: [] },
  { id: "p2", name: "Video Híbrido", icon: "🎬", desc: "Grabación local + IA", accent: "#22d3ee", example: "Clip grabado en el local + fondos o transiciones con IA.", exampleImages: [], guide: "", toolIds: [] },
  { id: "p3", name: "Carrusel", icon: "🎠", desc: "Secuencia de imágenes", accent: "#f472b6", example: "5-7 slides: problema → solución → beneficios → CTA.", exampleImages: [], guide: "", toolIds: [] },
  { id: "p4", name: "Pedestal", icon: "🏛️", desc: "Producto en pedestal estético", accent: "#d6ab99", example: "Producto centrado, fondo limpio, luz suave, macro.", exampleImages: [], guide: "", toolIds: [] },
  { id: "p5", name: "Especial", icon: "🎉", desc: "Fecha festiva del calendario", accent: "#34d399", example: "Pieza alusiva a la fecha (feriado/efeméride PY).", exampleImages: [], guide: "", toolIds: [] },
  { id: "p6", name: "Trends", icon: "🔥", desc: "Se copia un trend vigente", accent: "#fbbf24", example: "Audio o formato viral adaptado a un producto ElaBela.", exampleImages: [], guide: "", toolIds: [] },
];

export interface WeeklyReq {
  platform: string;
  format: string;
  freq: string;
  goal: string;
  done: number;
  target: number;
}

/** Requisitos Semanales de Publicación — con conteo real hecho/meta de la semana. */
export const WEEKLY_REQS: WeeklyReq[] = [
  { platform: "Instagram", format: "Reels", freq: "3-5 / semana", goal: "Alcance / Viralidad", done: 4, target: 5 },
  { platform: "Instagram", format: "Stories", freq: "2-5 / día", goal: "Fidelización / Venta", done: 9, target: 14 },
  { platform: "TikTok", format: "Video Corto", freq: "1-2 / día", goal: "Crecimiento rápido", done: 7, target: 10 },
  { platform: "Facebook", format: "Post / Video", freq: "3-4 / semana", goal: "Comunidad", done: 2, target: 4 },
];

export interface ProjectStep { label: string; done: boolean }
/** Historias por plataforma — el Admin edita mínimo/máximo/horarios. */
export interface StoryPlatform {
  platform: "Instagram" | "Facebook" | "TikTok";
  icon: string;
  min: number;
  max: number;
  schedules: string[]; // horarios sugeridos, ej. ["09:00","13:00","18:00"]
  done: number;        // subidas del día registrado en doneDate
  /** Fecha ISO (yyyy-mm-dd) a la que corresponde `done`; si no es hoy, el contador arranca de 0. */
  doneDate?: string;
  assignee: string;    // a quién le toca hoy
}

/** ISO de hoy (yyyy-mm-dd, hora local). */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Historias subidas HOY (si el contador quedó de otro día, vale 0). */
export const storyDoneToday = (s: StoryPlatform) => (s.doneDate === todayIso() ? s.done : 0);

export const STORY_CONFIG: StoryPlatform[] = [
  { platform: "Instagram", icon: "📸", min: 2, max: 5, schedules: ["09:00", "13:00", "18:00"], done: 3, assignee: "cielo" },
  { platform: "Facebook", icon: "📘", min: 1, max: 2, schedules: ["12:00"], done: 1, assignee: "elizabeth" },
  { platform: "TikTok", icon: "🎵", min: 1, max: 2, schedules: ["17:00"], done: 0, assignee: "cielo" },
];

export interface Project {
  id: string;
  name: string;
  owner: string;
  status: "todo" | "doing" | "done";
  createdAt: string;          // fecha de creación
  due?: string;               // fecha de entrega (opcional)
  archived?: boolean;
  contentMode: "steps" | "note";
  steps: ProjectStep[];
  note?: string;              // markdown (cuando contentMode = "note")
}

export const PROJECTS: Project[] = [
  {
    id: "pr1",
    name: "Relanzamiento línea Glow",
    owner: "cielo",
    status: "doing",
    createdAt: "2026-07-08",
    due: "2026-07-28",
    contentMode: "steps",
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
    createdAt: "2026-07-13",
    due: "2026-07-30",
    contentMode: "note",
    steps: [],
    note: "## Objetivo\nReforzar comunidad y ventas por el **Día del Amigo** (30/07).\n\n### Ideas\n- Reel *«etiquetá a tu amiga glow»* con sorteo\n- Combo 2x1 en labiales\n- Historia con encuesta: *¿cuál es tu producto ElaBela favorito?*\n\n> Tono cercano, divertido, foco en amistad.",
  },
  {
    id: "pr3",
    name: "Renovación de Banners WEB",
    owner: "cielo",
    status: "done",
    createdAt: "2026-07-01",
    due: "2026-07-10",
    contentMode: "steps",
    archived: true,
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
  link?: string;
  body?: string;
}

export const GUIONES: Guion[] = [
  {
    id: "g1", name: "Rutina noche Glow", state: "listo", product: "Sérum Vitamina C", brand: "Elaluz",
    record: "2026-07-12", publish: "2026-07-16", responsible: "cielo", types: ["Video Híbrido"],
    link: "https://drive.google.com/",
    body: "GANCHO (0-3s): «Tu piel a las 11pm vs con este sérum».\nDESARROLLO: aplicar 3 gotas, masaje ascendente, mostrar textura.\nCIERRE: «Glow que se nota al despertar» + CTA a la web.",
  },
  {
    id: "g2", name: "Unboxing Blush", state: "editando", product: "Blush Cremoso", brand: "Tarte",
    record: "2026-07-14", publish: "2026-07-18", responsible: "elizabeth", types: ["Carrusel", "Trends"],
    body: "Abrir la caja en cámara, primer plano del color, swatch en la mano y en la mejilla. Trend audio vigente.",
  },
  {
    id: "g3", name: "Tip protección solar", state: "falta", product: "Protector Solar FPS50", brand: "Elaluz",
    record: "2026-07-20", publish: "2026-07-22", responsible: "cielo", types: ["Video con IA"],
    body: "",
  },
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
  kind: "prompt" | "link"; // cómo se renderiza y usa cada recurso
  items: { label: string; href?: string; note?: string }[];
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: "prompts",
    kind: "prompt",
    title: "Prompts",
    emoji: "💬",
    desc: "Prompts listos para copiar",
    items: [
      { label: "Hook viral para Reels", note: "Genera 5 hooks en 3s" },
      { label: "Copy de venta suave", note: "Tono cercano, foco beneficio" },
    ],
  },
  {
    id: "apps",
    kind: "link",
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
    kind: "link",
    title: "IA",
    emoji: "🤖",
    desc: "Herramientas de IA del equipo",
    items: [
      { label: "Gemini", href: "https://gemini.google.com" },
      { label: "GEM · Content Studio", note: "Estética de marca" },
    ],
  },
  {
    id: "ads",
    kind: "link",
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
    kind: "link",
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

/**
 * Credential vault seed. `scope`:
 *   "shared"  = la ve TODO el equipo (cuentas/herramientas compartidas)
 *   "private" = solo la ve quien la creó
 * (los valores reales nunca se guardan en el repo)
 */
export const CREDENTIAL_PLATFORMS = [
  { platform: "Instagram", icon: "📸", scope: "shared" },
  { platform: "Facebook", icon: "📘", scope: "shared" },
  { platform: "TikTok", icon: "🎵", scope: "shared" },
  { platform: "WhatsApp Business", icon: "💬", scope: "shared" },
  { platform: "Later.com", icon: "📅", scope: "shared" },
  { platform: "Metricool", icon: "📊", scope: "shared" },
  { platform: "Relatorios (Catálogo)", icon: "📦", scope: "shared" },
] as const;
