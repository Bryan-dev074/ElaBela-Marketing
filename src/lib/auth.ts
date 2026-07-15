import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/brand";

export interface AppUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: Role;
}

/** Reads the authenticated user and normalizes role/username from user_metadata. */
export async function getUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const username = (meta.username as string) || email.split("@")[0] || "usuario";
  return {
    id: user.id,
    email,
    username,
    fullName: (meta.full_name as string) || username,
    role: (meta.role as Role) === "admin" ? "admin" : "marketer",
  };
}
