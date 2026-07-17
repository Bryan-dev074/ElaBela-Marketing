"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DAILY_TASKS, PROJECTS, GUIONES, CLIENTS, PRODUCTS, POST_TYPES, STORY_CONFIG, TOOL_CATEGORIES,
  type DailyTask, type Project, type Guion, type Client, type Product, type PostType, type StoryPlatform,
} from "@/lib/data";

const supabase = createClient();
const nn = (v: string | undefined) => (v && v.length ? v : null); // "" -> null for date cols

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
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    (async () => {
      let q = supabase.from(cfg.table).select("*");
      if (cfg.order) q = q.order(cfg.order.col, { ascending: cfg.order.asc ?? true });
      const { data, error } = await q;
      if (!live.current) return;
      if (!error && data && data.length) {
        setItems(data.map(cfg.fromRow));
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

  const add = (item: T) => {
    setItems((p) => [item, ...p]);
    supabase.from(cfg.table).insert(cfg.toRow(item)).then(() => {});
  };
  const upsert = (item: T) => {
    setItems((p) => (p.some((i) => idOf(i) === idOf(item)) ? p.map((i) => (idOf(i) === idOf(item) ? item : i)) : [item, ...p]));
    supabase.from(cfg.table).upsert(cfg.toRow(item)).then(() => {});
  };
  const update = (id: unknown, patch: Partial<T>) => {
    // The updater only computes state (StrictMode may run it twice — writing the
    // same local var is idempotent); the network write runs once, afterwards.
    // Upsert (not update) so edits to seed-only rows also persist.
    let row: T | undefined;
    setItems((p) => p.map((i) => (idOf(i) === id ? (row = { ...i, ...patch }) : i)));
    queueMicrotask(() => {
      if (row) supabase.from(cfg.table).upsert(cfg.toRow(row)).then(() => {});
    });
  };
  const remove = (id: unknown) => {
    setItems((p) => p.filter((i) => idOf(i) !== id));
    supabase.from(cfg.table).delete().eq(idKey, id as string).then(() => {});
  };

  return { items, setItems, add, upsert, update, remove, ready };
}

/* ---------------- Entity hooks ---------------- */

export const useDailyTasks = () =>
  useCollection<DailyTask>({
    table: "daily_tasks",
    seed: DAILY_TASKS,
    order: { col: "sort" },
    fromRow: (r) => ({ id: r.id as string, name: r.name as string, icon: (r.icon as string) || "✨", assignee: r.assignee as string, state: r.state as DailyTask["state"], note: (r.note as string) || undefined, rotation: (r.rotation as string[]) || undefined, days: (r.days as number[]) || undefined }),
    toRow: (t) => ({ id: t.id, name: t.name, icon: t.icon, assignee: t.assignee, state: t.state, note: t.note ?? null, rotation: t.rotation ?? null, days: t.days ?? null }),
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
    fromRow: (r) => ({ id: r.id as string, name: r.name as string, icon: (r.icon as string) || "✨", desc: (r.descr as string) || "", accent: (r.accent as string) || "#d6ab99", example: (r.example as string) || "", exampleImage: (r.example_image as string) || "" }),
    toRow: (p) => ({ id: p.id, name: p.name, icon: p.icon, descr: p.desc, accent: p.accent, example: p.example ?? null, example_image: p.exampleImage ?? null }),
  });

export const useStoryConfig = () =>
  useCollection<StoryPlatform>({
    table: "story_config",
    idKey: "platform",
    seed: STORY_CONFIG,
    fromRow: (r) => ({ platform: r.platform as StoryPlatform["platform"], icon: (r.icon as string) || "📸", min: (r.min as number) ?? 1, max: (r.max as number) ?? 2, schedules: (r.schedules as string[]) || [], done: (r.done as number) ?? 0, assignee: (r.assignee as string) || "" }),
    toRow: (s) => ({ platform: s.platform, icon: s.icon, min: s.min, max: s.max, schedules: s.schedules, done: s.done, assignee: s.assignee }),
  });

export interface ToolItem { id: string; category: string; kind: "prompt" | "link"; title: string; note: string; href: string; image: string; icon: string }
const TOOL_SEED: ToolItem[] = TOOL_CATEGORIES.flatMap((c) => c.items.map((it, i) => ({ id: `${c.id}-${i}`, category: c.id, kind: c.kind, title: it.label, note: it.note ?? "", href: it.href ?? "", image: "", icon: "" })));
export const useToolItems = () =>
  useCollection<ToolItem>({
    table: "tool_items",
    seed: TOOL_SEED,
    order: { col: "created_at" },
    fromRow: (r) => ({ id: r.id as string, category: r.category as string, kind: (r.kind as "prompt" | "link") || "link", title: r.title as string, note: (r.note as string) || "", href: (r.href as string) || "", image: (r.image as string) || "", icon: (r.icon as string) || "" }),
    toRow: (t) => ({ id: t.id, category: t.category, kind: t.kind, title: t.title, note: t.note ?? null, href: t.href ?? null, image: t.image ?? null, icon: t.icon || null }),
  });

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
