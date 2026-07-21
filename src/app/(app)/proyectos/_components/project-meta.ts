import type { ProjectPriority, ProjectType } from "@/lib/data";

export const PROJECT_TYPES: Array<{ value: ProjectType; label: string }> = [
  { value: "campaign", label: "Campaña" },
  { value: "launch", label: "Lanzamiento" },
  { value: "content", label: "Contenido" },
  { value: "brand-design", label: "Marca y diseño" },
  { value: "web-ecommerce", label: "Web / e-commerce" },
  { value: "event", label: "Evento" },
  { value: "crm", label: "CRM" },
  { value: "operations", label: "Operaciones" },
  { value: "other", label: "Otro" },
];

export const PROJECT_PRIORITIES: Array<{ value: ProjectPriority; label: string }> = [
  { value: "low", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export const projectTypeLabel = (type: ProjectType): string =>
  PROJECT_TYPES.find(({ value }) => value === type)?.label ?? type;

export const projectPriorityLabel = (priority: ProjectPriority): string =>
  PROJECT_PRIORITIES.find(({ value }) => value === priority)?.label ?? priority;

export function formatProjectAuditDate(value?: string): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-PY", { day: "numeric", month: "short", year: "numeric" });
}
