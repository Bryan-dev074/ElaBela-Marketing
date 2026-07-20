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
- `src/lib/__tests__/credential-category-schema.test.ts`: acepta el aborto explícito en lugar de renombrar datos heredados.

## Comandos y resultados

- `npx --yes supabase@latest migration new reconcile_remote_schema`: creó `20260720161004_reconcile_remote_schema.sql`.
- `npx tsc --noEmit`: aprobado, sin salida.
- `git diff --check`: aprobado; solo avisos informativos de conversión LF/CRLF en archivos existentes.
- Comparación read-only de los marcadores de cuerpo: `BodiesIdentical = True`.
- Auditoría read-only: cero `DROP TABLE`, `TRUNCATE` o conversiones de PK en migración/manual; cinco FKs `NOT VALID`; cuatro revocaciones de `PUBLIC`; etiquetas dollar-quote balanceadas.

## Auto-revisión y riesgos

- Idempotencia: columnas/tablas/índices/policies/triggers usan guardas o recreación controlada; inserts del sistema usan `ON CONFLICT`; el hotfix previo de logs es compatible.
- Seguridad: RLS y grants se aplican juntos; los cuatro RPC son `SECURITY INVOKER`, revocan `PUBLIC` y conceden solo a `authenticated`.
- No destrucción: no hay bootstrap de tablas base, triggers de `auth.users`, cambio de PK, reset, seed general, borrado de tablas ni limpieza de filas de usuario.
- Atomicidad: el manual envuelve mutaciones en `BEGIN/COMMIT`; la recarga de PostgREST ocurre después del commit.
- Datos heredados: blancos, duplicados u otras incompatibilidades abortan la transacción con un error español explícito; no se omiten restricciones o índices y no se renombran, fusionan ni borran filas.
- Normalización autorizada: valores inválidos/nulos de tipo o prioridad de proyecto se convierten a `other`/`normal` antes de los checks exactos.
- Verificación pendiente del usuario: por prohibición expresa no se levantó una base ni se ejecutó el SQL; la última consulta del script manual valida columnas/tablas críticas, RLS, policies, bucket y privilegios sin leer secretos ni filas de usuario.

## Correcciones posteriores al review crítico

- RED focal: `npm test -- src/lib/__tests__/supabase-reconcile-schema.test.ts` produjo 9 fallos esperados sobre reconciliación parcial, objetos homónimos y verificación final incompleta.
- Las tablas `tool_categories`, `credential_categories` y `daily_task_logs` ahora agregan todas sus columnas faltantes, verifican tipos, reparan únicamente defaults seguros, restauran `NOT NULL`, PK, unicidad, checks y FKs, y abortan con error español cuando el dato obligatorio o incompatible no admite una corrección semántica segura.
- Los constraints e índices homónimos se comparan por catálogo y definición real. Esto cubre checks, PK/unique, las cinco FKs relevantes, los índices de categorías, índices simples y el índice parcial `projects_completed_at_idx` con columna, orden descendente, null ordering y predicado exactos.
- Los checks y FKs reconciliados se validan después de comprobar datos huérfanos/incompatibles. Ya no se omiten constraints o índices mediante `NOTICE` ante datos legacy incompatibles: la transacción aborta sin borrar, renombrar ni fusionar datos.
- La verificación manual final audita 60 columnas (existencia, tipo, nullability y default), RLS incluyendo `credentials`, las 17 policies por rol único, comando, `USING` y `WITH CHECK`, FKs y `ON DELETE`, checks, PK/unique, índices, grants de tablas, los cuatro RPC `SECURITY INVOKER` con ACL autenticada y sin ejecución pública, y la definición completa del bucket.
- El cuerpo entre marcadores de migración y manual permanece idéntico; los bloques críticos también quedan en paridad con `supabase/schema.sql`.

### Validación fresca del follow-up

- Focal final: 3 archivos, 47/47 pruebas aprobadas; el contrato principal quedó en 33/33.
- Suite completa: 27 archivos, 245/245 pruebas aprobadas.
- `npx tsc --noEmit`: aprobado sin salida.
- `git diff --check`: aprobado.
- No hay `psql`, `postgres`, `pg_isready`, Docker, Supabase CLI local ni parser SQL instalado en el workspace; por ello no se pudo hacer parse/ejecución PostgreSQL local sin instalar dependencias o tocar un proyecto remoto. No se usó ningún recurso remoto.

## Correcciones del re-review final

- RED específico: el contrato principal produjo 5 fallos sobre agrupación de policies, RLS de `projects`, identidad/método de índices y documentación obsoleta.
- La auditoría de policies ya no elimina paréntesis ni casts y tampoco convierte toda la expresión a minúsculas. Solo elimina whitespace y reemplaza la forma exacta del subquery escalar `(SELECT auth.uid() AS uid)` por el átomo equivalente `auth.uid()`; las expresiones esperadas conservan la estructura booleana emitida por `pg_get_expr`.
- La prueba de regresión demuestra que dos expresiones con los mismos tokens pero agrupación distinta permanecen diferentes después de normalizar.
- `projects` forma parte del contrato RLS exacto junto con `credentials`, `tool_categories`, `credential_categories` y `daily_task_logs`.
- Los tres índices únicos de categorías y `projects_completed_at_idx` comprueban además `pg_index.indrelid` contra la tabla exacta. Esos cuatro índices, los seis índices simples y la verificación final exigen método `btree` mediante `pg_class.relam` y `pg_am`.
- Se corrigieron el comentario del script manual y las secciones históricas del informe: las incompatibilidades abortan la transacción y la reconciliación contiene cinco FKs declaradas inicialmente como `NOT VALID` antes de validarlas.
- Validación fresca: 4 archivos focales, 59/59 pruebas aprobadas; suite completa, 27 archivos y 247/247 pruebas aprobadas; `npx tsc --noEmit` aprobado.
