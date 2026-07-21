# Estado “En curso” con respiración azul

## Objetivo

Hacer que un proyecto activo en estado `doing` se reconozca de inmediato sin romper el lenguaje Premium Noir/Glow de ElaBela. La señal debe sentirse viva y elegante: una pastilla azul claramente semántica y una luz azul tenue que respira dentro de la tarjeta.

## Dirección visual aprobada

- **Dominio:** iniciativas, impulso, progreso, ruta de trabajo, equipo y finalización.
- **Mundo de color:** vidrio obsidiana, rosa ElaBela, azul eléctrico suavizado, blanco cálido, zinc tenue y verde de completado.
- **Firma:** un halo azul ambiental que solo existe mientras el proyecto está realmente `En curso`.
- **Se descarta:** teñir toda la tarjeta de azul, usar un borde que parpadee o aplicar el efecto a estados pasivos.

## Comportamiento

1. Solo una tarjeta de la sección activa con `project.status === "doing"` recibe el tratamiento.
2. La pastilla de estado usa texto azul claro, borde azul translúcido, fondo azul tenue y un resplandor corto.
3. La tarjeta conserva su superficie oscura. Detrás del contenido aparece un halo radial azul, sin interacción ni semántica, que anima únicamente `transform` y `opacity`.
4. La respiración dura 3.2 segundos, usa `easeInOut` y repite de forma continua con una amplitud contenida.
5. Con `prefers-reduced-motion`, el halo queda estático y tenue; no escala ni repite.
6. Los proyectos `todo`, `done`, completados o históricos conservan el aspecto existente.
7. El cambio no altera cursor, persistencia, estado, navegación ni mutaciones.

## Criterios de aceptación

- La pastilla “En curso” de una tarjeta activa es azul.
- Existe un único halo respirante, detrás del contenido, solo para esa tarjeta.
- El halo no bloquea clics ni lectura y tiene `aria-hidden="true"`.
- El modo de movimiento reducido elimina la respiración continua.
- Las pruebas distinguen `doing` de `todo` y validan el tratamiento reducido.

