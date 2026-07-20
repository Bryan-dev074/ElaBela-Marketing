import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const schema = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8").toLowerCase();

describe("expanded project schema", () => {
  it.each([
    "responsible_usernames", "completed_responsible_usernames", "project_type",
    "priority", "objective", "start_date", "completed_at", "completed_by",
  ])("contains %s in the canonical schema", (column) => expect(schema).toContain(column));

  it("indexes dated completions", () => {
    expect(schema).toContain("projects_completed_at_idx");
    expect(schema).toContain("where status = 'done'");
  });

  it("grants projects writes to authenticated users", () => {
    expect(schema).toContain("grant select, insert, update, delete on table public.projects to authenticated;");
  });
});
