import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FORBIDDEN = new RegExp([
  ["Weekly", "Task"].join(""),
  ["use", "Weekly", "Tasks"].join(""),
  ["weekly", "tasks"].join("_"),
  ["tarea", "semanal"].join(" "),
  ["tareas", "semanales"].join(" "),
  ["convertir", "en", "semanal"].join(" "),
].join("|"), "i");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : [full];
  });
}

describe("legacy weekly tasks removal", () => {
  it("contains no active weekly-task code in src or the canonical schema", () => {
    const files = [...sourceFiles(path.join(ROOT, "src")), path.join(ROOT, "supabase", "schema.sql")];
    const offenders = files.filter((file) => FORBIDDEN.test(fs.readFileSync(file, "utf8"))).map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("keeps the legacy table intact only as an explicit pending-migration comment", () => {
    const migration = fs.readFileSync(path.join(ROOT, "supabase", "migrations", "20260718174251_elabela_functional_upgrades.sql"), "utf8");
    const legacyName = ["weekly", "tasks"].join("_");
    expect(migration.toLowerCase()).toContain(`leaves legacy ${legacyName} and archived projects intact`);
    expect(migration.toLowerCase()).not.toContain(`drop table ${legacyName}`);
    expect(migration.toLowerCase()).not.toContain(`delete from ${legacyName}`);
  });
});
