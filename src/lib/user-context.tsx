"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/brand";

export interface CtxUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
}

const UserCtx = createContext<CtxUser | null>(null);

export function UserProvider({ user, children }: { user: CtxUser; children: React.ReactNode }) {
  return <UserCtx.Provider value={user}>{children}</UserCtx.Provider>;
}

export function useUser(): CtxUser {
  const u = useContext(UserCtx);
  return u ?? { id: "", username: "bryan", fullName: "Equipo", role: "marketer" };
}
