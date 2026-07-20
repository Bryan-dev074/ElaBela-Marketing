import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schema = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260718174251_elabela_functional_upgrades.sql"), "utf8");

describe.each([
  ["canonical schema", schema],
  ["pending migration", migration],
])("credential category SQL in %s", (_label, sql) => {
  it("enforces trimmed scoped names and explicit authenticated Data API grants", () => {
    expect(sql).toMatch(/credential_categories_name_nonblank[\s\S]*btrim\(name\)/);
    expect(sql).toMatch(/credential_categories_shared_name_ci_unique[\s\S]*where scope = 'shared'/i);
    expect(sql).toMatch(/credential_categories_private_name_ci_unique[\s\S]*owner_id[\s\S]*where scope = 'private'/i);
    expect(sql).toMatch(/grant select, insert, update, delete on table[\s\S]*public\.credential_categories[\s\S]*to authenticated/i);
  });

  it("uses authenticated ownership policies without weakening credential visibility", () => {
    expect(sql).toMatch(/create policy credential_categories_select[\s\S]*to authenticated[\s\S]*owner_id = \(select auth\.uid\(\)\)/i);
    expect(sql).toMatch(/create policy credential_categories_update[\s\S]*using[\s\S]*with check/i);
    expect(sql).toMatch(/create policy credentials_select[\s\S]*scope = 'shared' or owner_id = (?:\(select )?auth\.uid\(\)\)? or owner_id is null/i);
    expect(sql).not.toMatch(/create policy credentials_select[\s\S]{0,160}using \(true\)/i);
  });

  it("enforces category compatibility on credential writes with a security-invoker trigger", () => {
    expect(sql).toMatch(/function public\.enforce_credential_category_compatibility\(\)[\s\S]*security invoker/i);
    expect(sql).toMatch(/trigger enforce_credential_category_compatibility[\s\S]*on public\.credentials/i);
    expect(sql).toMatch(/category\.scope = 'shared'[\s\S]*new\.scope = 'shared'/i);
    expect(sql).toMatch(/category\.scope = 'private'[\s\S]*new\.owner_id = category\.owner_id/i);
  });

  it("provides scoped race-safe empty deletion and contiguous reorder RPCs", () => {
    expect(sql).toMatch(/function public\.delete_empty_credential_category\(p_category_id text\)[\s\S]*for update[\s\S]*from public\.credentials/i);
    expect(sql).toMatch(/function public\.reorder_credential_categories\(p_scope text, p_category_ids text\[\]\)[\s\S]*security invoker/i);
    expect(sql).toMatch(/reorder_credential_categories[\s\S]*lock table public\.credential_categories in share row exclusive mode/i);
    expect(sql).toMatch(/set sort = requested\.ordinality - 1/i);
    expect(sql).toMatch(/grant execute on function public\.delete_empty_credential_category\(text\) to authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.reorder_credential_categories\(text, text\[\]\) to authenticated/i);
  });
});
