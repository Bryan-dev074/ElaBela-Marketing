# Experiencia visual de Proyectos y cursor semántico

**Fecha:** 2026-07-21

**Estado:** diseño aprobado por el usuario; pendiente de implementación

**Repositorio:** `Bryan-dev074/ElaBela-Marketing`

## 1. Objetivo

Elevar la sección Proyectos hasta que se sienta como una parte central y cuidada de ElaBela, manteniendo el diseño Premium Noir/Glow que ya tiene la aplicación.

La mejora debe permitir:

- comprender el estado de cada proyecto con una mirada;
- abrir cualquier proyecto en una vista detallada, limpia y ordenada;
- revisar y completar pasos desde la tarjeta o desde el detalle;
- editar pasos como una secuencia visual en vez de un bloque de texto;
- sentir el avance mediante color y movimiento, sin convertir la interfaz en un espectáculo permanente;
- hacer que el cursor personalizado comunique la acción real bajo el puntero y no el estado del contenedor.

No se rediseña la aplicación completa ni se cambia su identidad visual.

## 2. Dirección de diseño

### Persona, tarea y sensación

- **Persona:** quien coordina el trabajo de marketing de ElaBela y necesita saber qué falta, quién responde y qué tan cerca está cada entrega.
- **Tarea principal:** entrar a un proyecto, comprenderlo y avanzar sus pasos sin perder contexto.
- **Sensación:** control editorial premium; precisa, fluida, cálida y deliberada.

### Mundo visual

- **Dominio:** campañas, entregas, responsables, hitos, secuencias, revisión y publicación.
- **Colores naturales:** obsidiana, grafito, champagne, nude rosado, cobre suave y esmeralda de cierre.
- **Firma:** una **ruta de progreso** que une el indicador de avance, la lista de pasos y el momento de finalización.

### Decisiones explícitas

- Se conserva la cuadrícula actual de proyectos; no se sustituye por un Kanban genérico.
- Se usa un modal central amplio como `Project Studio`; no se abre una página separada ni un panel lateral estrecho.
- El gradiente de marca expresa cuánto avanzó el proyecto. El verde continúa reservado para la finalización real.
- Las animaciones responden a abrir, completar, editar o cambiar estado. No se agregan pulsaciones o brillos ambientales continuos.
- El cursor deja de heredar el color de una tarjeta o tarea. Su aspecto representa la acción concreta disponible.

## 3. Alcance

### Incluido

- tarjetas activas y completadas de Proyectos;
- detalle completo y accionable;
- lista interactiva de pasos;
- editor estructurado de pasos;
- indicador de progreso gradual;
- transiciones y estados de espera/error;
- comportamiento responsive;
- accesibilidad de controles, diálogo, progreso y movimiento;
- sistema central de cursor semántico y corrección de sus usos engañosos en toda la aplicación.

### No incluido

- cambios en el modelo de datos o una migración nueva de Supabase;
- proyectos semanales;
- tablero Kanban, cronómetro, comentarios, archivos o subtareas anidadas;
- identificadores persistentes nuevos para pasos;
- cambio global de tipografías, navegación, fondo o paleta base;
- una celebración con confeti o animaciones permanentes.

## 4. Arquitectura de la vista

La página mantiene sus tres niveles actuales:

1. cabecera y acción `Nuevo proyecto`;
2. resumen y filtros de `Activos`, `Completados` y `Anteriores`;
3. cuadrícula de tarjetas.

La diferencia principal es que la tarjeta pasa a ser un resumen editorial y el modal se convierte en el lugar de trabajo completo.

### Descomposición recomendada

Los componentes específicos vivirán bajo `src/app/(app)/proyectos/_components/`:

- `ProjectCard`;
- `ProjectProgress`;
- `ProjectStepList`;
- `ProjectStepItem`;
- `ProjectDetailModal`;
- `ProjectEditorModal`;
- `ProjectStepsEditor`.

La página conservará la carga de datos, filtros, errores y callbacks de persistencia. No se duplicará lógica de negocio que ya existe en `src/lib/projects.ts`.

## 5. Tarjeta de proyecto

### Jerarquía

La lectura ocurre en este orden:

1. nombre y estado;
2. porcentaje o estado de contenido;
3. objetivo breve;
4. responsables, prioridad y fecha;
5. próximos pasos.

La tarjeta conserva su superficie grafito y borde tenue. El avance aparece como una línea de energía muy discreta en el borde superior y en el anillo, ambos derivados del mismo porcentaje.

### Apertura

- Hacer clic en el área de resumen abre el detalle.
- Los botones de estado y pasos siguen siendo controles hermanos independientes.
- No se convierte el `article` completo en un botón que contenga otros botones.
- En teclado existe un botón de apertura con nombre accesible `Abrir proyecto <nombre>`.
- El hover de apertura eleva la tarjeta entre 2 y 3 píxeles, aumenta levemente el contraste del borde y revela una flecha discreta.

### Contenido

- Se muestran como máximo cuatro pasos compactos.
- Si existen más, aparece `+N pasos más`, que abre el detalle.
- Los proyectos de tipo nota muestran estado y no un porcentaje inventado.
- Un proyecto terminado conserva la información, pero sus pasos quedan en lectura hasta elegir `Reabrir`.

## 6. Progreso de marca

El progreso usa el gradiente existente de ElaBela:

`nude-deep → nude → nude-soft`

La intensidad cambia con el avance:

- 0–24 %: trazo fino y tenue;
- 25–49 %: nude medio, sin halo;
- 50–74 %: gradiente completo y halo mínimo;
- 75–99 %: gradiente más luminoso y borde superior visible;
- 100 %: check esmeralda y estado `Completado`.

Reglas:

- siempre se muestra el valor textual `X de Y · Z %` cuando existen pasos;
- el indicador tiene nombre accesible y valores mínimo, máximo y actual;
- el porcentaje usa números tabulares para evitar saltos;
- el color nunca es la única forma de comunicar el progreso;
- la transición del trazo dura aproximadamente 240 ms y se elimina para movimiento reducido.

## 7. Pasos interactivos

### Presentación

Cada paso es una fila de al menos 44 píxeles con:

- indicador de secuencia;
- control de completado;
- texto;
- separador/conector de la ruta;
- estado de espera cuando se está guardando.

La numeración se justifica porque los pasos son una secuencia real. El conector continúa hasta el siguiente paso y gana contraste a medida que se completa la ruta.

### Estados

- **Pendiente:** círculo nude tenue y texto principal.
- **Hover/foco:** lavado cálido muy suave, círculo más definido y texto auxiliar `Marcar listo`.
- **Guardando:** control bloqueado y spinner pequeño; la fila no salta de tamaño.
- **Listo:** check con resorte corto, barrido de opacidad y texto atenuado/tachado.
- **Error:** se revierte el cambio optimista y se muestra el error existente sin cerrar el detalle.

En dispositivos táctiles la acción no depende de información que solo aparezca al pasar el mouse.

### Proyecto completado

Marcar el último paso conserva la regla actual que completa el proyecto. El detalle permanece visible durante la confirmación y muestra el estado final antes de que la tarjeta abandone `Activos`.

Desmarcar un paso de un proyecto terminado no será una acción accidental: primero se usa `Reabrir`, conservando la semántica de auditoría actual.

## 8. Project Studio: detalle central

El modal será ancho en escritorio y ocupará casi toda la pantalla disponible en móvil, reutilizando el componente `Modal` actual para foco, Escape, portal y restauración de foco.

### Cabecera

- tipo y prioridad como metadatos secundarios;
- nombre del proyecto como foco;
- objetivo debajo del nombre;
- selector de estado visible y funcional;
- menú de edición o botón `Editar` claramente separado.

### Resumen

- responsable principal y responsables adicionales;
- fecha de inicio, entrega y finalización si corresponde;
- autor de finalización cuando exista;
- progreso con cantidad de pasos;
- estado de contenido para proyectos de nota.

### Cuerpo

- modo pasos: ruta completa e interactiva;
- modo nota: Markdown legible dentro de una superficie editorial, sin forzar porcentaje;
- proyecto completado: pasos de lectura y acción principal `Reabrir`.

### Pie

- `Guardar` solo donde exista edición;
- `Completar proyecto` cuando aún no esté terminado;
- `Reabrir` cuando esté completado;
- `Editar proyecto` como acción secundaria;
- cualquier mutación bloquea únicamente las acciones relacionadas.

## 9. Editor estructurado de pasos

El textarea `uno por línea` se reemplaza visualmente por filas individuales.

Cada fila contiene:

- índice `01`, `02`, `03`;
- input del paso;
- botón para eliminar;
- conector y separador ya dibujados.

Interacciones:

- `Añadir paso` crea una fila al final y enfoca el input nuevo;
- Enter en la última fila añade otra;
- borrar una fila mantiene el orden visual;
- los pasos vacíos se descartan al guardar;
- al editar se preserva `done` por etiqueta, igual que en el comportamiento actual;
- no se implementa reordenamiento por arrastre porque los pasos todavía no tienen ID estable.

## 10. Movimiento

La animación utiliza Framer Motion ya instalado, con movimiento reducido según la preferencia del sistema.

- tarjeta: elevación y borde, 160–200 ms;
- apertura del modal: transición actual refinada, sin `scale(0)`;
- progreso: interpolación del trazo y opacidad, hasta 240 ms;
- check: escala 0.96 → 1 y barrido corto, 160–220 ms;
- inserción de paso: opacidad y desplazamiento máximo de 6 px;
- salida de tarjeta completada: breve y más rápida que la entrada;
- stagger de tarjetas limitado para no ralentizar listas largas.

Solo se animan `transform` y `opacity` siempre que sea posible. Con `prefers-reduced-motion` se conservan cambios de color/opacidad y se eliminan desplazamientos, resortes y escalas.

## 11. Cursor semántico global

### Problema actual

Algunos contenedores usan el color de su estado como metadata del cursor. Por eso una tarjeta `En curso` vuelve azul el cursor aunque la acción real sea únicamente abrirla.

### Regla nueva

El cursor representa **intención**, no contexto. Se agrega un vocabulario controlado de intenciones:

- `open`: nude neutro, `Abrir`;
- `edit`: nude claro, `Editar`;
- `complete`: esmeralda, `Completar`;
- `danger`: rojo apagado, `Eliminar`;
- `doing`: azul, solo en una acción que realmente cambie a `En curso`;
- `warning`: ámbar, para una acción de precaución real;
- `drag`: nude/cobre, `Arrastrar`;
- `copy`: nude claro, `Copiar`;
- `external`: nude claro, `Visitar`.

### Resolución inteligente

- Gana el elemento accionable más cercano al puntero.
- Un contenedor pasivo no transmite color o etiqueta a los botones internos.
- Un enlace o botón sin intención explícita usa el anillo nude neutro.
- Inputs y textareas mantienen el cursor nativo de escritura y no muestran globo contextual.
- Elementos deshabilitados no prometen una acción.
- Los estados siguen visibles dentro del componente, pero no colorean el cursor por simple hover.
- `stateCursorProps` queda restringido a opciones que cambian realmente un estado, no a tarjetas o filas completas.

La migración audita los usos existentes de `data-cursor-color`, `data-cursor-label` y `stateCursorProps` para corregir los contenedores engañosos sin eliminar etiquetas útiles.

## 12. Accesibilidad y responsive

- El modal conserva la trampa de foco, Escape y devolución del foco al disparador, siguiendo el patrón de diálogo modal de [WAI-ARIA](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- Los pasos usan controles con estado anunciado, siguiendo el patrón de [checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/).
- Todos los controles relevantes tienen área de interacción mínima de 44 por 44 píxeles.
- Hover y color nunca son la única señal de una acción o estado.
- El detalle se convierte en una sola columna en móvil; metadatos y acciones no desbordan.
- Las acciones principales permanecen visibles y ordenadas al final del diálogo.
- El foco es visible en tarjeta, pasos, filtros y acciones.
- El movimiento respeta `prefers-reduced-motion`, usando la estrategia recomendada por [Motion](https://motion.dev/docs/react-use-reduced-motion).

## 13. Rendimiento y estados operativos

- No se agregan nuevas consultas ni dependencias.
- Las listas derivadas conservan memoización donde aporte valor.
- El progreso SVG usa gradientes con identificadores únicos por instancia.
- El estado pendiente pasa a distinguir proyecto y operación para evitar desbloqueos prematuros.
- Las mutaciones mantienen actualización optimista, rollback y mensaje visible.
- No se animan propiedades de layout costosas en listas.

## 14. Estrategia de pruebas

La implementación se realiza con pruebas primero.

### Comportamiento

- la superficie de apertura abre el detalle sin interferir con los botones internos;
- el detalle presenta tipo, prioridad, responsables, objetivo, fechas, progreso y auditoría;
- el selector de estado funciona dentro del detalle;
- un paso puede completarse y revertirse desde tarjeta y detalle;
- el último paso completa el proyecto y mantiene feedback visible;
- un proyecto terminado exige reabrir antes de modificar pasos;
- `+N pasos más` aparece y abre el detalle;
- el editor añade, elimina y guarda filas individuales;
- el modo nota no muestra un porcentaje ficticio.

### Cursor

- una tarjeta `En curso` usa intención neutral al abrir;
- la opción concreta `En curso` usa azul;
- completar usa verde y eliminar usa rojo;
- un control interno prevalece sobre metadata de un ancestro;
- los campos de escritura no reciben globo ni color contextual.

### Accesibilidad y presentación

- controles con nombres y estados accesibles;
- progreso con valor textual y semántico;
- modal navegable con teclado;
- movimiento reducido sin transformaciones decorativas;
- comprobación visual en escritorio y móvil.

### Verificación final

- pruebas Vitest dirigidas y suite completa;
- TypeScript y build de producción;
- Playwright para el recorrido principal de Proyectos;
- revisión visual real en escritorio y móvil;
- inspección independiente del diff;
- push a la rama de trabajo y a `main` después de pasar todas las verificaciones.

## 15. Criterios de aceptación

La mejora queda terminada cuando:

- cualquier proyecto se abre en un detalle amplio, legible y completamente accionable;
- todos sus datos relevantes aparecen con jerarquía clara;
- los pasos se sienten como una secuencia, pueden marcarse y ofrecen feedback inmediato;
- el editor ya trae filas, índices y separadores visuales;
- el progreso gana intensidad de marca de manera gradual y conserva texto accesible;
- los proyectos de nota no inventan avance numérico;
- el detalle permite completar, cambiar estado, editar y reabrir sin controles ocultos;
- la experiencia funciona en móvil, teclado y movimiento reducido;
- el cursor no cambia a azul por estar sobre un elemento `En curso`;
- el cursor usa color solo cuando ese color comunica la acción concreta;
- el resto de ElaBela conserva su identidad y funcionamiento actuales.
