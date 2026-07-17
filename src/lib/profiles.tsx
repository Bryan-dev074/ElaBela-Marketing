"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/brand";

/**
 * Team profiles (with avatar photos) shared across the whole app.
 * Loaded once from the `profiles` table; falls back to the three seed
 * usernames if the table isn't reachable so the UI never breaks.
 */

export interface TeamProfile {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  avatar?: string; // data URL (compressed client-side)
}

const FALLBACK: TeamProfile[] = [
  { id: "", username: "bryan", fullName: "Bryan", role: "admin" },
  { id: "", username: "cielo", fullName: "Cielo", role: "marketer" },
  { id: "", username: "elizabeth", fullName: "Elizabeth", role: "marketer" },
];

interface ProfilesCtx {
  profiles: TeamProfile[];
  byUsername: (username: string) => TeamProfile | undefined;
  /** Persists a new avatar (data URL) for a profile and updates local state. */
  setAvatar: (id: string, avatar: string) => Promise<void>;
  refresh: () => void;
  ready: boolean;
}

const Ctx = createContext<ProfilesCtx>({
  profiles: FALLBACK,
  byUsername: (u) => FALLBACK.find((p) => p.username === u),
  setAvatar: async () => {},
  refresh: () => {},
  ready: false,
});

const supabase = createClient();

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<TeamProfile[]>(FALLBACK);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    supabase
      .from("profiles")
      .select("*")
      .then(({ data, error }) => {
        if (!error && data && data.length) {
          setProfiles(
            data.map((r) => ({
              id: r.id as string,
              username: (r.username as string) || "",
              fullName: (r.full_name as string) || (r.username as string) || "",
              role: (r.role as Role) === "admin" ? "admin" : "marketer",
              avatar: (r.avatar as string) || undefined,
            })),
          );
        }
        setReady(true);
      });
  }, []);

  useEffect(refresh, [refresh]);

  const value = useMemo<ProfilesCtx>(
    () => ({
      profiles,
      byUsername: (u) => profiles.find((p) => p.username.toLowerCase() === u?.toLowerCase()),
      setAvatar: async (id, avatar) => {
        setProfiles((p) => p.map((x) => (x.id === id ? { ...x, avatar } : x)));
        await supabase.from("profiles").update({ avatar }).eq("id", id);
      },
      refresh,
      ready,
    }),
    [profiles, refresh, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfiles(): ProfilesCtx {
  return useContext(Ctx);
}

/**
 * Reads an image File and compresses it (keeping aspect ratio, max side capped)
 * to a JPEG data URL small enough to live in a Supabase text column.
 */
export function fileToImage(file: File, maxSide = 800, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}

/**
 * Reads an image File, center-crops it to a square and compresses it to a
 * small data URL suitable for storing in the `profiles.avatar` column.
 */
export function fileToAvatar(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}
