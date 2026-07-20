"use client";

import { type SetStateAction, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DAILY_TASKS, PROJECTS, GUIONES, CLIENTS, PRODUCTS, POST_TYPES, STORY_CONFIG, TOOL_CATEGORIES,
  type DailyTask, type Project, type Guion, type Client, type Product, type PostType, type StoryPlatform, type WeeklyTask,
} from "@/lib/data";
import { normalizePublicationImages } from "@/lib/publications";
import {
  DEFAULT_TOOL_CATEGORIES,
  ensureLinksDownloader,
  normalizeLegacyCategory,
  type ToolCategoryRow,
} from "@/lib/tool-categories";

const supabase = createClient();
const nn = (v: string | undefined) => (v && v.length ? v : null); // "" -> null for date cols

export type CollectionMutationResult = { ok: true } | { ok: false; error: string };

export type Publication = PostType;

export function publicationFromRow(r: Record<string, unknown>): Publication {
  const exampleImages = normalizePublicationImages(
    Array.isArray(r.example_images)
      ? r.example_images.filter((image): image is string => typeof image === "string")
      : [],
    typeof r.example_image === "string" ? r.example_image : undefined,
  );

  return {
    id: r.id as string,
    name: r.name as string,
    icon: (r.icon as string) || "✨",
    desc: (r.descr as string) || "",
    accent: (r.accent as string) || "#d6ab99",
    example: (r.example as string) || "",
    exampleImage: exampleImages[0] || "",
    exampleImages,
    guide: (r.guide as string) || "",
    toolIds: Array.isArray(r.tool_ids) ? r.tool_ids.filter((id): id is string => typeof id === "string") : [],
  };
}

export function publicationToRow(p: Publication): Record<string, unknown> {
  const exampleImages = p.exampleImages.filter((image) => image.length > 0);
  return {
    id: p.id,
    name: p.name,
    icon: p.icon,
    descr: p.desc,
    accent: p.accent,
    example: p.example ?? null,
    example_image: exampleImages[0] ?? p.exampleImage ?? null,
    example_images: exampleImages,
    guide: p.guide,
    tool_ids: p.toolIds,
  };
}

export function postTypeToRow(post: PostType): Record<string, unknown> {
  return publicationToRow({
    ...post,
    exampleImages: normalizePublicationImages(post.exampleImages, post.exampleImage),
    guide: post.guide ?? "",
    toolIds: post.toolIds ?? [],
  });
}

/**
 * Loads a collection from Supabase; if the table errors (not migrated) or is empty,
 * falls back to the local seed so the UI never breaks. Writes go through to Supabase
 * (best-effort, optimistic) so data persists and syncs across modules and sessions.
 */
export function useCollection<T extends object>(cfg: {
  table: string;
  idKey?: string;
  seed: T[];
  fromRow: (r: Record<string, unknown>) => T;
  toRow: (i: T) => Record<string, unknown>;
  order?: { col: string; asc?: boolean };
}) {
  const idKey = cfg.idKey ?? "id";
  const idOf = (i: T) => (i as Record<string, unknown>)[idKey];
  const [items, setItems] = useState<T[]>(cfg.seed);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useRef(true);
  const itemsRef = useRef<T[]>(cfg.seed);
  const mutationVersions = useRef(new Map<unknown, number>());

  const setCurrentItems = (next: T[] | ((current: T[]) => T[])) => {
    const resolved = typeof next === "function" ? (next as (current: T[]) => T[])(itemsRef.current) : next;
    itemsRef.current = resolved;
    setItems(resolved);
  };
  const startMutation = (id: unknown) => {
    const version = (mutationVersions.current.get(id) ?? 0) + 1;
    mutationVersions.current.set(id, version);
    return version;
  };
  const isLatestMutation = (id: unknown, version: number) => mutationVersions.current.get(id) === version;
  const setCollectionItems = (next: SetStateAction<T[]>) => {
    setCurrentItems((current) => typeof next === "function"
      ? (next as (previous: T[]) => T[])(current)
      : next);
  };

  useEffect(() => {
    live.current = true;
    (async () => {
      let q = supabase.from(cfg.table).select("*");
      if (cfg.order) q = q.order(cfg.order.col, { ascending: cfg.order.asc ?? true });
      const { data, error } = await q;
      if (!live.current) return;
      if (!error && data && data.length) {
        setCurrentItems(data.map(cfg.fromRow));
      } else if (!error && data && cfg.seed.length) {
        // Table reachable but empty: bootstrap it with the seed so that later
        // update/remove calls hit real rows and survive a reload.
        supabase.from(cfg.table).upsert(cfg.seed.map(cfg.toRow), { ignoreDuplicates: true }).then(() => {});
      }
      setReady(true);
    })();
    return () => { live.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearError = () => setError(null);
  const addAsync = async (item: T): Promise<CollectionMutationResult> => {
    const id = idOf(item);
    const version = startMutation(id);
    const previous = itemsRef.current;
    const previousItem = previous.find((currentItem) => idOf(currentItem) === id);
    const previousIndex = previous.findIndex((currentItem) => idOf(currentItem) === id);
    setCurrentItems([item, ...previous.filter((currentItem) => idOf(currentItem) !== id)]);
    const { error: mutationError } = await supabase.from(cfg.table).insert(cfg.toRow(item));
    if (mutationError) {
      if (isLatestMutation(id, version)) {
        setCurrentItems((current) => previousItem
          ? current.some((currentItem) => idOf(currentItem) === id)
            ? current.map((currentItem) => (idOf(currentItem) === id ? previousItem : currentItem))
            : [...current.slice(0, previousIndex), previousItem, ...current.slice(previousIndex)]
          : current.filter((currentItem) => idOf(currentItem) !== id));
      }
      setError(mutationError.message);
      return { ok: false, error: mutationError.message };
    }
    return { ok: true };
  };
  const upsertAsync = async (item: T): Promise<CollectionMutationResult> => {
    const id = idOf(item);
    const version = startMutation(id);
    const previous = itemsRef.current;
    const previousItem = previous.find((currentItem) => idOf(currentItem) === id);
    const next = previous.some((i) => idOf(i) === idOf(item))
      ? previous.map((i) => (idOf(i) === idOf(item) ? item : i))
      : [item, ...previous];
    setCurrentItems(next);
    const { error: mutationError } = await supabase.from(cfg.table).upsert(cfg.toRow(item));
    if (mutationError) {
      if (isLatestMutation(id, version)) {
        setCurrentItems((current) => previousItem
          ? current.map((currentItem) => (idOf(currentItem) === id ? previousItem : currentItem))
          : current.filter((currentItem) => idOf(currentItem) !== id));
      }
      setError(mutationError.message);
      return { ok: false, error: mutationError.message };
    }
    return { ok: true };
  };
  const updateAsync = async (id: unknown, patch: Partial<T>): Promise<CollectionMutationResult> => {
    const previous = itemsRef.current;
    const row = previous.find((item) => idOf(item) === id);
    if (!row) return { ok: true };
    const version = startMutation(id);
    const updated = { ...row, ...patch };
    setCurrentItems(previous.map((item) => (idOf(item) === id ? updated : item)));
    const { error: mutationError } = await supabase.from(cfg.table).upsert(cfg.toRow(updated));
    if (mutationError) {
      if (isLatestMutation(id, version)) setCurrentItems((current) => current.map((item) => (idOf(item) === id ? row : item)));
      setError(mutationError.message);
      return { ok: false, error: mutationError.message };
    }
    return { ok: true };
  };
  const removeAsync = async (id: unknown): Promise<CollectionMutationResult> => {
    const previous = itemsRef.current;
    const removed = previous.find((item) => idOf(item) === id);
    const previousIndex = previous.findIndex((item) => idOf(item) === id);
    const version = startMutation(id);
    setCurrentItems(previous.filter((item) => idOf(item) !== id));
    const { error: mutationError } = await supabase.from(cfg.table).delete().eq(idKey, id as string);
    if (mutationError) {
      if (removed && isLatestMutation(id, version)) {
        setCurrentItems((current) => current.some((item) => idOf(item) === id)
          ? current
          : [...current.slice(0, previousIndex), removed, ...current.slice(previousIndex)]);
      }
      setError(mutationError.message);
      return { ok: false, error: mutationError.message };
    }
    return { ok: true };
  };

  const add = (item: T) => { void addAsync(item); };
  const upsert = (item: T) => { void upsertAsync(item); };
  const update = (id: unknown, patch: Partial<T>) => { void updateAsync(id, patch); };
  const remove = (id: unknown) => { void removeAsync(id); };

  return { items, setItems: setCollectionItems, add, upsert, update, remove, addAsync, upsertAsync, updateAsync, removeAsync, error, clearError, ready };
}

/* ---------------- Entity hooks ---------------- */

export const useDailyTasks = () =>
  useCollection<DailyTask>({
    table: "daily_tasks",
    seed: DAILY_TASKS,
    order: { col: "sort" },
    fromRow: (r) => ({ id: r.id as string, name: r.name as string, icon: (r.icon as string) || "✨", assignee: r.assignee as string, state: r.state as DailyTask["state"], note: (r.note as string) || undefined, rotation: (r.rotation as string[]) || undefined, days: (r.days as number[]) || undefined, dayAssignees: (r.day_assignees as string[]) || undefined, postType: (r.post_type as string) || undefined }),
    toRow: (t) => ({ id: t.id, name: t.name, icon: t.icon, assignee: t.assignee, state: t.state, note: t.note ?? null, rotation: t.rotation ?? null, days: t.days ?? null, day_assignees: t.dayAssignees ?? null, post_type: t.postType ?? null }),
  });

/** Tareas semanales: bolsa sin fecha que se arrastra al calendario (como proyectos chicos). */
export const useWeeklyTasks = () =>
  useCollection<WeeklyTask>({
    table: "weekly_tasks",
    seed: [],
    order: { col: "created_at", asc: false },
    fromRow: (r) => ({ id: r.id as string, name: r.name as string, icon: (r.icon as string) || "✨", assignee: (r.assignee as string) || "", date: (r.task_date as string) || undefined, state: (r.state as WeeklyTask["state"]) || "todo", postType: (r.post_type as string) || undefined, createdAt: ((r.created_at as string) || "").slice(0, 10) }),
    toRow: (t) => ({ id: t.id, name: t.name, icon: t.icon, assignee: t.assignee, task_date: nn(t.date), state: t.state, post_type: t.postType ?? null }),
  });

export const useProjects = () =>
  useCollection<Project>({
    table: "projects",
    seed: PROJECTS,
    order: { col: "created_at", asc: false },
    fromRow: (r) => ({ id: r.id as string, name: r.name as string, owner: r.owner as string, status: r.status as Project["status"], createdAt: (r.created_at as string)?.slice(0, 10), due: (r.due_date as string) || undefined, archived: !!r.archived, contentMode: (r.content_mode as Project["contentMode"]) || "steps", steps: (r.steps as Project["steps"]) || [], note: (r.note as string) || undefined }),
    toRow: (p) => ({ id: p.id, name: p.name, owner: p.owner, status: p.status, created_at: p.createdAt, due_date: nn(p.due), archived: !!p.archived, content_mode: p.contentMode, steps: p.steps, note: p.note ?? null }),
  });

export const useGuiones = () =>
  useCollection<Guion>({
    table: "guiones",
    seed: GUIONES,
    order: { col: "created_at", asc: false },
    fromRow: (r) => ({ id: r.id as string, name: r.name as string, state: r.state as Guion["state"], product: (r.product as string) || "—", brand: (r.brand as string) || "", record: (r.record_date as string) || "", publish: (r.publish_date as string) || "", responsible: (r.responsible as string) || "", types: (r.types as string[]) || [], link: (r.link as string) || undefined, body: (r.body as string) || "" }),
    toRow: (g) => ({ id: g.id, name: g.name, state: g.state, product: g.product, brand: g.brand, record_date: nn(g.record), publish_date: nn(g.publish), responsible: g.responsible, types: g.types, link: g.link ?? null, body: g.body ?? null }),
  });

export const useClients = () =>
  useCollection<Client>({
    table: "clients",
    seed: CLIENTS,
    order: { col: "created_at", asc: false },
    fromRow: (r) => ({ id: r.id as string, name: r.name as string, whatsapp: (r.whatsapp as string) || "", main: (r.main_channel as Client["main"]) || "Instagram", bought: !!r.bought, lastPurchase: (r.last_purchase as string) || undefined, nextContact: (r.next_contact as string) || undefined }),
    toRow: (c) => ({ id: c.id, name: c.name, whatsapp: c.whatsapp, main_channel: c.main, bought: c.bought, last_purchase: nn(c.lastPurchase), next_contact: nn(c.nextContact) }),
  });

export const useProducts = () =>
  useCollection<Product>({
    table: "products",
    idKey: "code",
    seed: PRODUCTS,
    fromRow: (r) => ({ code: r.code as string, name: r.name as string, brand: (r.brand as string) || "", category: (r.category as string) || "", durationDays: (r.duration_days as number) || 30 }),
    toRow: (p) => ({ code: p.code, name: p.name, brand: p.brand, category: p.category, duration_days: p.durationDays }),
  });

export const usePostTypes = () =>
  useCollection<PostType>({
    table: "post_types",
    seed: POST_TYPES,
    order: { col: "sort" },
    fromRow: publicationFromRow,
    toRow: postTypeToRow,
  });

export const useStoryConfig = () =>
  useCollection<StoryPlatform>({
    table: "story_config",
    idKey: "platform",
    seed: STORY_CONFIG,
    fromRow: (r) => ({ platform: r.platform as StoryPlatform["platform"], icon: (r.icon as string) || "📸", min: (r.min as number) ?? 1, max: (r.max as number) ?? 2, schedules: (r.schedules as string[]) || [], done: (r.done as number) ?? 0, doneDate: (r.done_date as string) || undefined, assignee: (r.assignee as string) || "" }),
    toRow: (s) => ({ platform: s.platform, icon: s.icon, min: s.min, max: s.max, schedules: s.schedules, done: s.done, done_date: s.doneDate ?? null, assignee: s.assignee }),
  });

export interface ToolItem { id: string; category: string; categoryId: string; kind: "prompt" | "link"; title: string; note: string; href: string; image: string; icon: string; steps: string }

function currentToolCategory(categoryId: string) {
  return categoryId === "redes-sociales" ? "links" : categoryId;
}

export function toolItemFromRow(r: Record<string, unknown>): ToolItem {
  const legacyCategory = typeof r.category === "string" ? r.category : "";
  const categoryId = typeof r.category_id === "string" && r.category_id
    ? normalizeLegacyCategory(r.category_id)
    : normalizeLegacyCategory(legacyCategory);

  return {
    id: r.id as string,
    category: currentToolCategory(categoryId),
    categoryId,
    kind: (r.kind as "prompt" | "link") || "link",
    title: r.title as string,
    note: (r.note as string) || "",
    href: (r.href as string) || "",
    image: (r.image as string) || "",
    icon: (r.icon as string) || "",
    steps: (r.steps as string) || "",
  };
}

export function toolItemToRow(t: ToolItem): Record<string, unknown> {
  const categoryId = normalizeLegacyCategory(t.categoryId || t.category || "");
  return {
    id: t.id,
    category: currentToolCategory(categoryId),
    category_id: categoryId,
    kind: t.kind,
    title: t.title,
    note: t.note ?? null,
    href: t.href ?? null,
    image: t.image ?? null,
    icon: t.icon || null,
    steps: t.steps || null,
  };
}

const LEGACY_TOOL_SEED: ToolItem[] = TOOL_CATEGORIES.flatMap((c) => c.items.map((it, i) => ({
  id: `${c.id}-${i}`,
  category: currentToolCategory(normalizeLegacyCategory(c.id)),
  categoryId: normalizeLegacyCategory(c.id),
  kind: c.kind,
  title: it.label,
  note: it.note ?? "",
  href: it.href ?? "",
  image: "",
  icon: "",
  steps: "",
})));
const TOOL_SEED: ToolItem[] = ensureLinksDownloader(
  LEGACY_TOOL_SEED.filter((tool) => tool.title !== "Links Downloader"),
) as ToolItem[];
export const useToolItems = () =>
  useCollection<ToolItem>({
    table: "tool_items",
    seed: TOOL_SEED,
    order: { col: "created_at" },
    fromRow: toolItemFromRow,
    toRow: toolItemToRow,
  });

export function toolCategoryFromRow(r: Record<string, unknown>): ToolCategoryRow {
  return {
    id: r.id as string,
    name: (r.name as string)?.trim(),
    icon: (r.icon as string) || "✨",
    accent: (r.accent as string) || "#d6ab99",
    kind: r.kind === "prompt" ? "prompt" : "link",
    sort: typeof r.sort === "number" ? r.sort : 0,
    createdAt: (r.created_at as string) || "",
  };
}

export function toolCategoryToRow(category: ToolCategoryRow): Record<string, unknown> {
  return {
    id: category.id,
    name: category.name.trim(),
    icon: category.icon || "✨",
    accent: category.accent,
    kind: category.kind,
    sort: category.sort,
  };
}

export const useToolCategories = () =>
  useCollection<ToolCategoryRow>({
    table: "tool_categories",
    seed: DEFAULT_TOOL_CATEGORIES,
    order: { col: "sort" },
    fromRow: toolCategoryFromRow,
    toRow: toolCategoryToRow,
  });

export async function moveAndDeleteToolCategory(categoryId: string, destinationId?: string): Promise<CollectionMutationResult> {
  const { error } = await supabase.rpc("move_and_delete_tool_category", {
    p_category_id: categoryId,
    p_destination_id: destinationId ?? null,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function reorderToolCategories(categoryIds: string[]): Promise<CollectionMutationResult> {
  const { error } = await supabase.rpc("reorder_tool_categories", {
    p_category_ids: categoryIds,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export interface CalEventRow { id: string; date: string; kind: "tarea" | "proyecto"; title: string; owner: string }
export const useCalendarEvents = () =>
  useCollection<CalEventRow>({
    table: "calendar_events",
    seed: [],
    order: { col: "event_date" },
    fromRow: (r) => ({ id: r.id as string, date: r.event_date as string, kind: r.kind as "tarea" | "proyecto", title: r.title as string, owner: (r.owner as string) || "" }),
    toRow: (e) => ({ id: e.id, event_date: e.date, kind: e.kind, title: e.title, owner: e.owner }),
  });

export interface BrandAsset { id: string; kind: "color" | "font"; name: string; value: string; role: string }
export const useBrandAssets = () =>
  useCollection<BrandAsset>({
    table: "brand_assets",
    seed: [],
    order: { col: "created_at" },
    fromRow: (r) => ({ id: r.id as string, kind: (r.kind as "color" | "font") || "color", name: r.name as string, value: r.value as string, role: (r.role_label as string) || "" }),
    toRow: (a) => ({ id: a.id, kind: a.kind, name: a.name, value: a.value, role_label: a.role }),
  });

export interface CredRow { id: string; platform: string; icon: string; idType: "email" | "usuario"; identifier: string; secret: string; scope: "shared" | "private"; ownerId?: string }
export const useCredentials = (ownerId: string) =>
  useCollection<CredRow>({
    table: "credentials",
    seed: [],
    order: { col: "created_at" },
    fromRow: (r) => ({ id: r.id as string, platform: r.platform as string, icon: (r.icon as string) || "🔑", idType: (r.id_type as "email" | "usuario") || "email", identifier: (r.identifier as string) || "", secret: (r.secret as string) || "", scope: (r.scope as "shared" | "private") || "private", ownerId: (r.owner_id as string) || undefined }),
    toRow: (c) => ({ id: c.id, platform: c.platform, icon: c.icon, id_type: c.idType, identifier: c.identifier ?? null, secret: c.secret ?? null, scope: c.scope, owner_id: c.scope === "private" ? (c.ownerId || ownerId || null) : null }),
  });
