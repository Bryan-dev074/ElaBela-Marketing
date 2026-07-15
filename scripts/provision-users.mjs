// Crea los usuarios iniciales de ElaBela en Supabase Auth usando la service key.
// Uso:  node scripts/provision-users.mjs
// Requiere:
//   .env.local  -> NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   scripts/.secrets.users.json  (gitignored) -> lista de usuarios + contraseñas
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* env may already be set in the shell */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const domain = process.env.NEXT_PUBLIC_LOGIN_EMAIL_DOMAIN || "elabela.app";

if (!url || !key) {
  console.error("✗ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
let users;
try {
  users = JSON.parse(readFileSync(join(here, ".secrets.users.json"), "utf8"));
} catch {
  console.error(
    "✗ Falta scripts/.secrets.users.json (gitignored). Formato:\n" +
      '  [{ "username":"bryan", "full_name":"Bryan", "role":"admin", "password":"..." }]',
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`→ Provisionando ${users.length} usuarios en ${url}\n`);

for (const u of users) {
  const email = `${u.username}@${domain}`;
  const { error } = await supabase.auth.admin.createUser({
    email,
    password: u.password,
    email_confirm: true,
    user_metadata: { username: u.username, full_name: u.full_name, role: u.role },
  });
  if (error) {
    console.log(`  ✗ ${u.username.padEnd(12)} ${error.message}`);
  } else {
    console.log(`  ✓ ${u.username.padEnd(12)} (${u.role}) → ${email}`);
  }
}

console.log("\nListo. Iniciá sesión con el usuario (sin el @dominio) y su contraseña.");
