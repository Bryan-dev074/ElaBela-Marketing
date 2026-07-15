# ElaBela · Marketing & Growth Platform

Plataforma interna de marketing y CRM de **ElaBela**, construida a partir del canvas *"CRM ElaBela"*.
Diseño premium con fondo interactivo animado (reacciona al mouse y a cada clic), tema cálido oscuro
derivado del Manual de Marca, y módulos para todo el flujo de trabajo del equipo.

![stack](https://img.shields.io/badge/Next.js-15-black) ![react](https://img.shields.io/badge/React-19-149eca) ![supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-3ecf8e)

## ✨ Características

- **Fondo vivo interactivo** — campo de partículas en tonos de marca que sigue el cursor y genera una onda + shockwave con cada clic (respeta `prefers-reduced-motion`).
- **Autenticación con roles** (Supabase Auth): `admin` (Bryan) y `marketer` (Cielo, Elizabeth). El rol solo lo ve el Admin. Cada perfil puede cambiar su contraseña.
- **Módulos** (del canvas): Panel Principal, Calendario (con feriados de Paraguay), Tareas Diarias (+ Historias IG 2–5), Publicaciones (tipos de post + cumplimiento semanal), Guiones (Kanban), Proyectos (checklists), HUB de Clientes/Productos, Tools, Manual de Marca (colores/fuentes extensibles) y Credenciales (por nivel).

## 🧱 Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Framer Motion · Supabase (`@supabase/ssr`) · lucide-react. Listo para desplegar en **Vercel**.

## 🚀 Desarrollo local

```bash
npm install
cp .env.example .env.local   # y completá tus claves de Supabase
npm run dev                  # http://localhost:3000
```

### Variables de entorno (`.env.local`)

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave **publishable** (segura para el navegador) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave **secreta** — solo servidor / scripts. **Nunca** se commitea |
| `NEXT_PUBLIC_LOGIN_EMAIL_DOMAIN` | Dominio para mapear usuario → email (`bryan` → `bryan@elabela.app`) |

## 🗄️ Configurar Supabase

1. **Esquema** — pegá `supabase/schema.sql` en el *SQL Editor* de Supabase (o `supabase db push`). Crea tablas, RLS y el trigger que sincroniza el perfil desde los metadatos del usuario.
2. **Usuarios iniciales** — creá `scripts/.secrets.users.json` (gitignored):
   ```json
   [
     { "username": "bryan", "full_name": "Bryan", "role": "admin", "password": "•••" },
     { "username": "cielo", "full_name": "Cielo", "role": "marketer", "password": "•••" },
     { "username": "elizabeth", "full_name": "Elizabeth", "role": "marketer", "password": "•••" }
   ]
   ```
   y ejecutá `npm run provision`. (Los 3 usuarios ya fueron creados en el proyecto actual.)

### Cuentas

| Usuario | Rol | Contraseña |
|---|---|---|
| `bryan` | Admin | *(la que definiste)* |
| `cielo` | Marketer | *(la que definiste)* |
| `elizabeth` | Marketer | *(la que definiste)* |

Se inicia sesión con el **usuario** (sin `@dominio`) y la contraseña. Cielo y Elizabeth pueden cambiar su contraseña en **Mi Perfil**.

## ▲ Deploy a Vercel

1. Subí el repo a GitHub (ya conectado a `Bryan-dev074/ElaBela-Marketing`).
2. En Vercel → *New Project* → importá el repo.
3. Cargá las 4 variables de entorno (usá los mismos valores de `.env.local`; la `SERVICE_ROLE_KEY` marcala como *Sensitive*).
4. Deploy. Framework detectado: **Next.js** (sin configuración extra).

## 🔒 Seguridad

- Ningún secreto vive en el repo: `.env*.local`, `scripts/.secrets*` y cualquier `Credenciales*.md` están en `.gitignore`.
- Las credenciales de plataformas se guardan **encriptadas en reposo** (columna `secret_encrypted`), nunca en texto plano.
- RLS activo en todas las tablas; el Admin es el único que ve datos del equipo.

## 🧪 Tests

```bash
npm run test:e2e   # Playwright (requiere: npx playwright install)
```

## 📁 Estructura

```
src/
  app/                 # rutas (App Router)
    (app)/             # área autenticada + shell
    login/             # login + server actions
  components/          # shell, fondo, UI, vistas de módulos
  lib/                 # supabase, auth, brand, seed data
supabase/schema.sql    # esquema + RLS + trigger
scripts/               # provisión de usuarios
```

---

Hecho con 🤎 para ElaBela.
