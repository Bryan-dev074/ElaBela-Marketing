"use client";

import { Avatar } from "@/components/Avatar";
import { normalizeAdditionalResponsibles } from "@/lib/projects";
import { useProfiles } from "@/lib/profiles";
import { cursorIntentProps } from "@/lib/cursor-intent";

export type ProjectResponsiblePickerProps = {
  owner: string;
  value: string[];
  onChange: (usernames: string[]) => void;
  disabled?: boolean;
};

export function ProjectResponsiblePicker({ owner, value, onChange, disabled = false }: ProjectResponsiblePickerProps) {
  const { profiles } = useProfiles();

  return (
    <div className="flex flex-wrap gap-2">
      {profiles.filter(({ username }) => username !== owner).map((profile) => {
        const pressed = value.includes(profile.username);
        return (
          <button
            key={profile.username}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => {
              const next = pressed
                ? value.filter((username) => username !== profile.username)
                : [...value, profile.username];
              onChange(normalizeAdditionalResponsibles(owner, next));
            }}
            {...cursorIntentProps("open", profile.fullName || profile.username)}
            className={`press flex h-9 items-center gap-2 rounded-xl border px-3 text-sm capitalize transition ${
              pressed
                ? "border-nude/60 bg-nude/15 text-white shadow-[0_0_18px_-6px_rgba(214,171,153,0.7)]"
                : "border-white/10 text-[var(--muted)] hover:border-white/25 hover:text-white"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Avatar username={profile.username} size={20} ring={pressed} />
            {profile.username}
          </button>
        );
      })}
    </div>
  );
}
