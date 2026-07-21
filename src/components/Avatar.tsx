"use client";

import { useProfiles } from "@/lib/profiles";
import { cursorIntentProps } from "@/lib/cursor-intent";

/**
 * Team avatar: shows the profile photo when set, otherwise a deterministic
 * brand-palette gradient with the initial. Used everywhere a member is named.
 */

const GRADIENTS = [
  "linear-gradient(135deg, #d6ab99, #b98a76)",
  "linear-gradient(135deg, #c18468, #8b6357)",
  "linear-gradient(135deg, #dec2ad, #c18468)",
  "linear-gradient(135deg, #dbb09f, #71453f)",
  "linear-gradient(135deg, #e6c9bb, #b98a76)",
];

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Avatar({
  username,
  size = 24,
  className = "",
  ring = false,
  title,
}: {
  username: string;
  size?: number;
  className?: string;
  /** Adds a subtle nude ring (for "featured" placements like the sidebar). */
  ring?: boolean;
  title?: string;
}) {
  const { byUsername } = useProfiles();
  const p = byUsername(username);
  const name = p?.fullName || username || "?";
  const ringCls = ring ? "ring-1 ring-nude/40 ring-offset-1 ring-offset-black/60" : "";

  if (p?.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={p.avatar}
        alt={name}
        title={title ?? name}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${ringCls} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      title={title ?? name}
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-[#2a1712] ${ringCls} ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.44)),
        background: GRADIENTS[hash(username || "?") % GRADIENTS.length],
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Avatar + @username inline chip, for metadata rows ("responsable", "asignado a"). */
export function AvatarChip({
  username,
  size = 18,
  className = "",
}: {
  username: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Avatar username={username} size={size} />
      <span className="capitalize">{username}</span>
    </span>
  );
}

/**
 * Shared "responsable" picker: avatar chips for every team profile, sourced
 * from ProfilesProvider so newly created profiles appear everywhere.
 */
export function OwnerPicker({
  value,
  onChange,
  size = "md",
}: {
  value: string;
  onChange: (username: string) => void;
  size?: "sm" | "md";
}) {
  const { profiles } = useProfiles();
  const pad = size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm";
  return (
    <div className="flex flex-wrap gap-2">
      {profiles.map((p) => {
        const on = value === p.username;
        return (
          <button
            key={p.username}
            type="button"
            onClick={() => onChange(p.username)}
            {...cursorIntentProps("open", p.fullName || p.username)}
            className={`press flex items-center gap-2 rounded-xl border capitalize transition ${pad} ${
              on
                ? "border-nude/60 bg-nude/15 text-white shadow-[0_0_18px_-6px_rgba(214,171,153,0.7)]"
                : "border-white/10 text-[var(--muted)] hover:border-white/25 hover:text-white"
            }`}
          >
            <Avatar username={p.username} size={size === "sm" ? 18 : 20} ring={on} />
            {p.username}
          </button>
        );
      })}
    </div>
  );
}

/** Overlapping stack of avatars (rotations, teams). */
export function AvatarStack({ usernames, size = 20 }: { usernames: string[]; size?: number }) {
  return (
    <span className="inline-flex items-center" role="img" aria-label={`Responsables: ${usernames.join(", ")}`}>
      {usernames.map((u, i) => (
        <span key={u + i} style={{ marginLeft: i === 0 ? 0 : -size * 0.35, zIndex: usernames.length - i }} className="relative inline-flex rounded-full border border-black/60">
          <Avatar username={u} size={size} />
        </span>
      ))}
    </span>
  );
}
