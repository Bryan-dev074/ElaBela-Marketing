"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getUser } from "@/lib/auth";
import type { Role } from "@/lib/brand";

function admin() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAdmin() {
  const u = await getUser();
  if (!u || u.role !== "admin") throw new Error("No autorizado");
  return u;
}

const domain = () => process.env.NEXT_PUBLIC_LOGIN_EMAIL_DOMAIN || "elabela.app";

export interface ProfileRow {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  email: string;
}

export async function listProfiles(): Promise<ProfileRow[]> {
  await requireAdmin();
  const { data } = await admin().auth.admin.listUsers({ perPage: 100 });
  return (data?.users ?? [])
    .map((u) => {
      const m = u.user_metadata ?? {};
      return {
        id: u.id,
        email: u.email ?? "",
        username: (m.username as string) || u.email?.split("@")[0] || "",
        fullName: (m.full_name as string) || (m.username as string) || "",
        role: (m.role as Role) === "admin" ? "admin" : "marketer",
      } as ProfileRow;
    })
    .sort((a, b) => (a.role === b.role ? a.username.localeCompare(b.username) : a.role === "admin" ? -1 : 1));
}

export async function createProfile(input: { username: string; fullName: string; role: Role; password: string }): Promise<{ error?: string }> {
  await requireAdmin();
  const username = input.username.trim().toLowerCase();
  if (!username || input.password.length < 6) return { error: "Usuario y contraseña (mín. 6) requeridos." };
  const { error } = await admin().auth.admin.createUser({
    email: `${username}@${domain()}`,
    password: input.password,
    email_confirm: true,
    user_metadata: { username, full_name: input.fullName || username, role: input.role },
  });
  return { error: error?.message };
}

export async function updateProfile(input: { id: string; fullName: string; role: Role; password?: string }): Promise<{ error?: string }> {
  await requireAdmin();
  const { data: existing } = await admin().auth.admin.getUserById(input.id);
  const username = (existing?.user?.user_metadata?.username as string) || existing?.user?.email?.split("@")[0] || "";
  const attrs: { user_metadata: Record<string, unknown>; password?: string } = {
    user_metadata: { username, full_name: input.fullName, role: input.role },
  };
  if (input.password && input.password.length >= 6) attrs.password = input.password;
  const { error } = await admin().auth.admin.updateUserById(input.id, attrs);
  return { error: error?.message };
}

export async function deleteProfile(id: string): Promise<{ error?: string }> {
  const me = await requireAdmin();
  if (id === me.id) return { error: "No podés eliminar tu propia cuenta." };
  const { error } = await admin().auth.admin.deleteUser(id);
  return { error: error?.message };
}
