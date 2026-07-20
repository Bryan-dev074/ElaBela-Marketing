# Supabase remote reconciliation report

## Resultado

Se creó una migración forward-only y un script manual copy/paste con el mismo cuerpo de reconciliación. El cuerpo valida prerrequisitos, completa columnas usadas por la app, recupera las dos migraciones funcionales, endurece los cuatro RPC y evita sobrescribir o eliminar datos heredados. No se conectó ni ejecutó SQL contra ningún proyecto local o remoto.

## TDD

- RED: `npm test -- src/lib/__tests__/supabase-reconcile-schema.test.ts`
  - Resultado esperado: 1 archivo fallido, 22 pruebas fallidas porque aún no existían la migración/manual y faltaba paridad de seguridad en `schema.sql`.
- GREEN requerido: `npm test -- src/lib/__tests__/supabase-reconcile-schema.test.ts src/lib/__tests__/project-schema.test.ts`
  - Resultado: 2 archivos aprobados, 33/33 pruebas aprobadas.
- Regresión estática ampliada: se ejecutaron además las pruebas vecinas de tareas diarias y categorías de credenciales.
  - Resultado final: 4 archivos aprobados, 47/47 pruebas aprobadas.
- Suite completa fresca antes del commit: `npm test`.
  - Resultado: 27 archivos aprobados, 235/235 pruebas aprobadas.

## Archivos

- `supabase/migrations/20260720161004_reconcile_remote_schema.sql`: migración generada por la CLI y cuerpo forward-only.
- `supabase/manual/20260720_complete_remote_sync.sql`: instrucciones SQL Editor, transacción, cuerpo idéntico, recarga PostgREST y verificación booleana final.
- `supabase/schema.sql`: paridad para checks exactos de proyectos, FKs explícitas, guardas de categorías y permisos RPC.
- `src/lib/__tests__/supabase-reconcile-schema.test.ts`: contrato estático completo y prohibiciones destructivas.
- `src/lib/__tests__/daily-task-schema.test.ts`: acepta la FK reconciliada fuera de la definición inline.
- `src/lib/__tests__/credential-category-schema.test.ts`: acepta preservación con aviso en lugar de renombrar datos heredados.

## Comandos y resultados

- `npx --yes supabase@latest migration new reconcile_remote_schema`: creó `20260720161004_reconcile_remote_schema.sql`.
- `npx tsc --noEmit`: aprobado, sin salida.
- `git diff --check`: aprobado; solo avisos informativos de conversión LF/CRLF en archivos existentes.
- Comparación read-only de los marcadores de cuerpo: `BodiesIdentical = True`.
- Auditoría read-only: cero `DROP TABLE`, `TRUNCATE` o conversiones de PK en migración/manual; cuatro FKs `NOT VALID`; cuatro revocaciones de `PUBLIC`; etiquetas dollar-quote balanceadas.

## Auto-revisión y riesgos

- Idempotencia: columnas/tablas/índices/policies/triggers usan guardas o recreación controlada; inserts del sistema usan `ON CONFLICT`; el hotfix previo de logs es compatible.
- Seguridad: RLS y grants se aplican juntos; los cuatro RPC son `SECURITY INVOKER`, revocan `PUBLIC` y conceden solo a `authenticated`.
- No destrucción: no hay bootstrap de tablas base, triggers de `auth.users`, cambio de PK, reset, seed general, borrado de tablas ni limpieza de filas de usuario.
- Atomicidad: el manual envuelve mutaciones en `BEGIN/COMMIT`; la recarga de PostgREST ocurre después del commit.
- Datos heredados: blancos/duplicados de categorías producen `NOTICE` y omiten la restricción o índice incompatible. Una FK o check con el nombre esperado pero definición distinta produce un error español explícito en vez de reemplazarse.
- Normalización autorizada: valores inválidos/nulos de tipo o prioridad de proyecto se convierten a `other`/`normal` antes de los checks exactos.
- Verificación pendiente del usuario: por prohibición expresa no se levantó una base ni se ejecutó el SQL; la última consulta del script manual valida columnas/tablas críticas, RLS, policies, bucket y privilegios sin leer secretos ni filas de usuario.
