# Proyectos ampliados, notas con Gemini y recorte de avatar

**Estado:** diseño funcional aprobado en conversación el 20 de julio de 2026; este documento fija el contrato antes de implementar.

## 1. Objetivo

Ampliar la gestión de proyectos sin reemplazar el diseño visual actual de ElaBela y mejorar la carga de fotos de perfil. El resultado debe permitir:

- describir mejor cada proyecto con tipo, prioridad, objetivo y fechas;
- mantener una responsable principal y sumar varias responsables adicionales;
- separar proyectos activos, completados y anteriores;
- filtrar proyectos completados por quienes eran responsables al completarlos;
- generar, bajo pedido, una nota Markdown descriptiva a partir del nombre de un proyecto mediante Gemini;
- elegir visualmente qué parte de una foto se usará como avatar;
- conservar compatibilidad con los proyectos y avatares existentes.

Esta entrega no reintroduce proyectos semanales ni ninguna recurrencia semanal.

## 2. Alcance y límites

### Incluido

- Modelo de proyecto ampliado y migración aditiva de Supabase.
- Flujo único de completar y reabrir proyectos.
- Secciones Activos, Completados y Anteriores dentro de Proyectos.
- Filtro de completados por perfil responsable.
- Actualización del calendario con una bandeja compacta para agendar pendientes y una ocurrencia histórica en la fecha real de finalización.
- Generación protegida de notas con Gemini para el modo `Solo nota`.
- Editor Markdown existente después de generar la nota.
- Recorte cuadrado, desplazamiento y zoom para la foto personal y para las fotos administradas desde la lista de perfiles.
- Pruebas unitarias, de integración y de navegador para los contratos críticos.

### No incluido

- Rediseño global de la aplicación o cambio del sistema visual actual.
- Proyectos semanales, recurrencias, presupuestos, control horario, archivos adjuntos grandes o un registro completo de actividad.
- Sustituir `owner` por un sistema normalizado de membresías.
- Guardar el archivo original del avatar o crear un bucket nuevo para avatares.
- Generación automática al seleccionar `Solo nota`.
- Una conversación continua con Gemini o memoria de interacciones.

## 3. Compatibilidad con el sistema actual

`owner` sigue siendo el nombre de usuario de la responsable principal. No se renombra ni se elimina porque ya está presente en los datos, selectores y vistas actuales.

`contentMode` conserva los valores `steps` y `note`. En la interfaz se muestran como `Checklist` y `Solo nota`. `Solo nota` es un modo de contenido, no un tipo de proyecto.

La columna heredada `archived` se conserva en la base de datos para no destruir información, pero la interfaz deja de ofrecer Archivar, Restaurar o cambios nuevos sobre esa columna.

Los valores faltantes de filas anteriores se interpretan así:

- `responsibleUsernames`: lista vacía;
- `projectType`: `other`;
- `priority`: `normal`;
- `objective`: texto vacío;
- `startDate`: sin fecha;
- campos de finalización: sin datos hasta que exista una finalización real.

No se inventan fechas ni responsables históricos.

## 4. Modelo de proyecto

El tipo de aplicación `Project` incorpora estos campos:

| Campo | Tipo | Regla |
| --- | --- | --- |
| `owner` | `string` | Responsable principal; obligatoria al crear o editar. |
| `responsibleUsernames` | `string[]` | Responsables adicionales, únicas y sin repetir `owner`. |
| `projectType` | `ProjectType` | Tipo funcional del proyecto. |
| `priority` | `ProjectPriority` | Prioridad operativa. |
| `objective` | `string` opcional | Explicación breve del resultado buscado. |
| `startDate` | `string` opcional | Fecha ISO `yyyy-mm-dd`. |
| `due` | `string` opcional | Fecha de entrega existente. |
| `completedAt` | `string` opcional | Instante real de finalización en ISO. |
| `completedBy` | `string` opcional | UUID del usuario autenticado que realizó la transición. |
| `completedResponsibleUsernames` | `string[]` opcional | Foto inmutable de responsables al completar. |

### Tipos disponibles

| Identificador | Etiqueta |
| --- | --- |
| `campaign` | Campaña |
| `launch` | Lanzamiento |
| `content` | Contenido |
| `brand-design` | Marca y diseño |
| `web-ecommerce` | Web y e-commerce |
| `event` | Evento |
| `crm` | CRM |
| `operations` | Operaciones |
| `other` | Otro |

### Prioridades disponibles

| Identificador | Etiqueta |
| --- | --- |
| `low` | Baja |
| `normal` | Normal |
| `high` | Alta |
| `urgent` | Urgente |

### Reglas de responsables

- La responsable principal se elige con el selector de perfiles actual.
- Las responsables adicionales se eligen con un selector múltiple que utiliza los perfiles existentes.
- Se eliminan duplicados antes de persistir.
- Si un perfil elegido como adicional pasa a ser principal, se retira de la lista adicional.
- El conjunto usado al completar es la unión única de `[owner, ...responsibleUsernames]`.
- Los nombres de usuario se guardan como instantánea para que el historial siga siendo interpretable aunque un perfil sea eliminado después.

## 5. Ciclo de vida y clasificación

Toda acción que cambie el estado usa una única función de dominio, equivalente a:

```ts
transitionProjectStatus(project, nextStatus, actorId, now)
```

Esta función se usa desde la tarjeta, el detalle, el formulario de edición y la finalización automática del checklist.

### Completar

Al pasar de `todo` o `doing` a `done`:

- `status` pasa a `done`;
- `completedAt` recibe el instante actual;
- `completedBy` recibe el UUID del usuario autenticado;
- `completedResponsibleUsernames` recibe la unión única de responsable principal y adicionales.

Volver a aplicar `done` sobre un proyecto ya terminado es idempotente: no reemplaza la fecha, el actor ni la instantánea originales.

### Reabrir

Al pasar de `done` a `todo` o `doing`:

- se limpian `completedAt`, `completedBy` y `completedResponsibleUsernames`;
- el proyecto vuelve a Activos;
- una finalización futura crea una instantánea nueva con las responsables vigentes.

### Secciones

- **Activos:** proyectos con estado distinto de `done` y sin `archived` heredado.
- **Completados:** proyectos con `status = done` y `completedAt` real, ordenados del más reciente al más antiguo.
- **Anteriores:** proyectos con `status = done` y sin una fecha de finalización confiable, estén o no marcados como archivados por el sistema anterior.
- Las filas heredadas con `archived = true` y estado distinto de `done` permanecen en la base, no aparecen en las vistas operativas y no se modifican.

Los proyectos de Anteriores no cuentan en métricas mensuales. Un proyecto completado cuenta una sola vez en el total general, aunque puede aparecer en el desglose de cada perfil incluido en su instantánea.

El filtro por perfil de Completados busca en `completedResponsibleUsernames`, no en `completedBy`. Este último es únicamente un dato de auditoría sobre quién pulsó Completar.

## 6. Experiencia de Proyectos

La página conserva tarjetas, colores, tipografía, modales y densidad visual actuales. Se amplía en el mismo lenguaje visual:

- navegación entre Activos, Completados y Anteriores;
- filtros compactos de responsable, tipo y prioridad donde sean útiles;
- tipo y prioridad visibles sin dominar la tarjeta;
- responsable principal y pila de avatares de responsables adicionales;
- objetivo y fechas completas en el detalle;
- botón `Reabrir` en un proyecto completado;
- ausencia total de botones Archivar y Restaurar.

El formulario de alta y edición permite nombre, tipo, prioridad, objetivo, fecha de inicio, fecha de entrega, responsable principal, responsables adicionales y modo de contenido.

La bandeja lateral y el modal para agendar proyectos usan la misma colección: únicamente proyectos `todo` con `archived = false`. La bandeja comienza plegada, muestra el total pendiente y despliega una lista con altura limitada para no crecer sin control. Los proyectos `doing`, `done` y archivados no pueden arrastrarse ni agendarse desde allí.

Cada proyecto produce como máximo una ocurrencia en el calendario:

- un proyecto `todo` o `doing` con fecha de entrega aparece en `due` como entrega;
- un proyecto `done` con `completedAt` válido aparece en la fecha de Paraguay correspondiente a ese instante como completado;
- al completar, `completedAt` reemplaza a `due` como única ocurrencia, aunque las fechas sean distintas;
- un proyecto terminado heredado sin `completedAt` o cualquier fila archivada no aparece en el calendario.

Las ocurrencias completadas se identifican como `Completado` y no ofrecen Desagendar porque su fecha procede de la auditoría. Las entregas pendientes conservan la acción de desagendar.

## 7. Generación de nota con Gemini

### Interacción

Cuando el modo de contenido es `Solo nota`, aparece el botón `Generar con IA` después de que exista un nombre de proyecto no vacío.

- Elegir `Solo nota` no ejecuta ninguna solicitud.
- Pulsar el botón inicia la generación y muestra un estado de carga sin bloquear el resto de la aplicación.
- Si la nota está vacía, el resultado se inserta en el editor.
- Si ya hay contenido, se pide confirmación explícita antes de reemplazarlo.
- El texto generado sigue siendo Markdown editable y se guarda en el campo `note` existente.
- Un error conserva tanto el nombre como la nota anterior y ofrece reintentar.

### Forma del documento generado

La nota se redacta en español, con tono claro y profesional, entre 250 y 500 palabras. Usa el nombre del proyecto como único contexto de negocio y esta estructura:

```md
# Nombre del proyecto

Párrafo introductorio breve.

## Qué es

Explicación descriptiva.

## Por qué es importante

Justificación y necesidad.

## Enfoque

Descripción narrativa del criterio general.
```

No debe producir instrucciones paso a paso, listas de tareas, checklists, cronogramas inventados, responsables inventados ni afirmaciones presentadas como hechos que no se deduzcan del nombre.

### Límite servidor

El navegador llama únicamente a `POST /api/projects/generate-note` con un cuerpo JSON equivalente a `{ "name": string }`. Una respuesta correcta usa `{ "note": string }`; un fallo usa `{ "error": { "code": string, "message": string, "retryable": boolean } }` y el estado HTTP correspondiente.

La ruta:

1. autentica la sesión con Supabase en el servidor;
2. rechaza métodos distintos de `POST`;
3. normaliza el nombre, exige contenido y limita su longitud a 160 caracteres;
4. crea la instrucción cerrada para el formato anterior;
5. llama desde el servidor a `POST https://generativelanguage.googleapis.com/v1/interactions`;
6. usa `store: false` y el modelo configurado;
7. aplica un tiempo máximo de 20 segundos;
8. extrae solo texto final de `model_output` y rechaza como inválida una respuesta vacía o superior a 6.000 caracteres;
9. devuelve un contrato JSON estable sin exponer detalles sensibles del proveedor.

La integración usa REST para no añadir una dependencia de SDK innecesaria. El modelo predeterminado es `gemini-3.5-flash`, configurable mediante `GEMINI_MODEL`. La credencial se lee exclusivamente desde `GEMINI_API_KEY` en el entorno del servidor.

La clave proporcionada por el usuario no se imprime, no se guarda en la base de datos, no se devuelve al cliente y no se incorpora al repositorio. Debe rotarse por haber sido compartida en una conversación y configurarse de nuevo en `.env.local` y en el entorno de despliegue.

### Errores

La ruta transforma errores en estados comprensibles:

- sesión ausente: autenticación requerida;
- clave ausente o inválida, o permisos 401/403: configuración de IA no disponible;
- respuesta 429: cuota temporalmente agotada, con opción de reintentar después;
- tiempo agotado o fallo 5xx: servicio temporalmente no disponible;
- respuesta vacía, bloqueada o mal formada: no se pudo generar una nota válida;
- entrada inválida: mensaje de validación sin llamar a Gemini.

Los mensajes visibles no incluyen la clave, cabeceras, el prompt interno ni el cuerpo bruto del proveedor. La aplicación no promete una cuota gratuita fija porque depende del proyecto y del modelo configurados.

## 8. Recorte de foto de perfil

### Flujo

La selección de una imagen válida abre un modal de recorte antes de persistirla. El mismo componente se usa en:

- la foto grande del perfil personal;
- cada foto editable de la administración de perfiles.

El modal contiene:

- área cuadrada de recorte con arrastre horizontal y vertical;
- control de zoom entre `1x` y `3x`;
- vista previa circular que representa el avatar final;
- acciones Cancelar y Guardar foto.

Cancelar cierra el modal y deja intacto el avatar existente. Guardar renderiza la región elegida en un `canvas` de 256 por 256 píxeles y produce JPEG con calidad aproximada de `0.82`, compatible con el campo `profiles.avatar` actual.

### Validación y recursos

- Se aceptan JPEG, PNG y WebP de hasta 8 MB.
- Se rechazan archivos corruptos o sin dimensiones válidas antes de abrir el editor.
- La imagen siempre cubre el cuadrado; no pueden quedar franjas vacías al arrastrar.
- El zoom y la posición se limitan a valores válidos.
- Los `object URL` temporales se revocan al reemplazar imagen, cancelar, guardar o desmontar el componente.
- El archivo original no se conserva. Para encuadrarlo de otra manera, el usuario vuelve a cargarlo.

La operación de persistencia debe devolver éxito o error real. Mientras guarda, se evita el doble envío. Si Supabase falla, el avatar anterior permanece, se muestra el error y el modal conserva el encuadre para volver a intentar. Solo un guardado confirmado cierra el modal y actualiza la imagen visible.

La acción existente para quitar una foto se mantiene.

## 9. Supabase y persistencia

Se crea una migración nueva y aditiva, y se refleja el mismo estado final en `supabase/schema.sql`. No se confía en modificar una migración que podría estar aplicada. La tabla `projects` recibe, con operaciones idempotentes:

```sql
responsible_usernames text[] not null default '{}'
completed_responsible_usernames text[]
project_type text not null default 'other'
priority text not null default 'normal'
objective text
start_date date
completed_at timestamptz
completed_by uuid references public.profiles(id) on delete set null
```

La migración agrega restricciones para los identificadores válidos de tipo y prioridad, y un índice parcial por `completed_at` para proyectos terminados. Los mapeadores convierten nombres `snake_case` de Supabase a los campos de aplicación y aplican los valores heredados definidos en este documento.

Se mantiene la política compartida actual: usuarios autenticados pueden administrar proyectos. La ruta de Gemini exige una sesión autenticada, aunque la clave de Gemini exista en el servidor.

La instantánea de responsables y los datos de finalización se escriben junto con la transición de estado. La interfaz revierte o informa el fallo si la persistencia no se confirma; no presenta como terminada una operación fallida.

## 10. Accesibilidad, rendimiento y seguridad

- El recortador funciona con puntero y controles de teclado; los controles tienen etiquetas accesibles y foco visible.
- Los modales retienen el foco, se cierran de forma segura con Escape cuando no hay guardado en curso y devuelven el foco al disparador.
- Las pilas de avatares incluyen nombres accesibles, no solo imágenes.
- Los estados de carga y error se anuncian sin depender únicamente del color.
- No se hace una llamada a Gemini durante renderizados, cambios de pestaña o cambios del selector.
- No se incorpora la imagen original en registros ni mensajes de error.
- Ninguna variable privada usa el prefijo público de Next.js.

## 11. Estrategia de pruebas

La implementación se hace con pruebas primero para cada comportamiento de dominio.

### Proyectos

- completar escribe fecha, actor e instantánea única;
- completar dos veces conserva la primera auditoría;
- reabrir limpia todos los campos de finalización;
- completar por checklist usa la misma transición;
- mapeo de filas nuevas y valores heredados;
- clasificación correcta en Activos, Completados y Anteriores;
- filas archivadas heredadas no se modifican ni aparecen como activas;
- filtro por responsables al completar, incluidas múltiples responsables;
- total general sin duplicar proyectos;
- bandeja y modal de calendario solo permiten agendar proyectos `todo` no archivados;
- calendario muestra cada completado una sola vez en la fecha paraguaya de `completedAt` y no en `due`;
- no existen controles de archivo/restauración ni referencias semanales en el flujo nuevo.

### Gemini

- ruta sin sesión, nombre vacío y nombre demasiado largo;
- generación correcta y extracción del texto final;
- clave ausente, 401/403, 429, 5xx, tiempo agotado y respuesta mal formada;
- `store: false`, modelo configurable y secreto ausente del bundle cliente;
- confirmación antes de sobrescribir una nota;
- fallo de generación conserva la nota previa.

### Avatar

- validación de formato, tamaño y dimensiones;
- límites de arrastre y zoom;
- recorte final 256 por 256 en JPEG;
- cancelar no cambia el avatar;
- las dos entradas de foto usan el mismo recortador;
- error de persistencia conserva el avatar anterior y permite reintentar;
- revocación de recursos temporales.

### Verificación final

- suite completa de Vitest;
- comprobación de TypeScript y compilación de producción;
- pruebas Playwright de los recorridos principales;
- revisión manual en escritorio y móvil manteniendo el diseño actual;
- búsqueda de claves o secretos antes de hacer commit;
- revisión independiente del diff antes del push de cada bloque.

## 12. Entrega

La implementación se divide en dos bloques verificables:

1. Proyectos ampliados, historial de completados y generación de nota con Gemini.
2. Recorte y persistencia confiable de avatares.

Cada bloque puede tener su propio commit y push después de pasar sus pruebas. La migración se aplica al proyecto Supabase indicado solo después de validar localmente el código y confirmar que la CLI está enlazada al `project-ref` correcto.

## 13. Criterios de aceptación

La funcionalidad queda aceptada cuando:

- un proyecto admite una principal y varias responsables adicionales sin duplicados;
- tipo, prioridad, objetivo y fechas se guardan y reaparecen al recargar;
- completar y reabrir conservan las reglas de auditoría e instantáneas;
- Completados filtra por las responsables existentes al momento de completar;
- los proyectos históricos sin fecha aparecen en Anteriores y no alteran métricas;
- desaparece el flujo de archivar/restaurar y no regresa ningún proyecto semanal;
- `Solo nota` genera Markdown solo al pulsar el botón y nunca reemplaza contenido sin confirmación;
- la clave de Gemini permanece únicamente del lado servidor y los fallos son recuperables;
- ambas cargas de avatar permiten encuadrar y ampliar antes de guardar;
- un fallo de guardado nunca muestra como definitivo un avatar que no fue persistido;
- la apariencia general continúa siendo la interfaz actual de ElaBela, ampliada funcionalmente y sin un rediseño global.
