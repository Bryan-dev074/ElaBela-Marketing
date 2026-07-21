# Project Doing Breathing State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a las tarjetas activas `En curso` una pastilla azul y un halo azul respirante, elegante y accesible.

**Architecture:** `ProjectCard` deriva un único booleano semántico desde la sección efectiva y el estado del proyecto. Ese booleano controla tanto las clases de la pastilla como un `motion.span` decorativo detrás del contenido; Framer Motion desactiva la repetición cuando `useReducedMotion()` es verdadero.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion, Vitest y Testing Library.

## Global Constraints

- Aplicar el efecto únicamente a `effectiveSection === "active" && project.status === "doing"`.
- Animar solo `transform` y `opacity`.
- Con movimiento reducido, usar un halo estático sin repetición.
- No modificar cursor, datos, persistencia ni acciones de la tarjeta.
- Preservar sin cambios los estados `todo`, `done`, completados e históricos.

---

### Task 1: Tratamiento visual del proyecto En curso

**Files:**
- Modify: `src/app/(app)/proyectos/_components/ProjectCard.tsx`
- Test: `src/app/(app)/proyectos/_components/__tests__/ProjectCard.test.tsx`

**Interfaces:**
- Consumes: `Project.status`, `ProjectSection`, `useReducedMotion()` y el mock existente de Framer Motion.
- Produces: `data-project-doing-glow="true"` únicamente en tarjetas activas `doing`, y clases azules en el botón `Cambiar estado`.

- [ ] **Step 1: Escribir las pruebas que fallen**

```tsx
it("gives only an active doing project a blue status pill and breathing glow", () => {
  renderCard();
  expect(screen.getByRole("button", { name: "Cambiar estado de Campaña Glow" }))
    .toHaveClass("border-blue-400/40", "bg-blue-500/15", "text-blue-200");
  expect(document.querySelector("[data-project-doing-glow]"))
    .toBeInTheDocument();
});

it("keeps non-doing cards free of the blue breathing treatment", () => {
  renderCard({ value: project({ status: "todo" }) });
  expect(document.querySelector("[data-project-doing-glow]"))
    .not.toBeInTheDocument();
});
```

- [ ] **Step 2: Verificar RED**

Run: `npm.cmd test -- "src/app/(app)/proyectos/_components/__tests__/ProjectCard.test.tsx"`

Expected: FAIL porque la pastilla aún es neutra y el halo no existe.

- [ ] **Step 3: Implementar el mínimo comportamiento visual**

```tsx
const isActiveDoing = effectiveSection === "active" && project.status === "doing";

{isActiveDoing ? (
  <motion.span
    data-project-doing-glow="true"
    aria-hidden="true"
    initial={false}
    animate={reducedMotion
      ? { opacity: 0.18, scale: 1 }
      : { opacity: [0.12, 0.26, 0.12], scale: [0.96, 1.04, 0.96] }}
    transition={reducedMotion
      ? { duration: 0 }
      : { duration: 3.2, ease: "easeInOut", repeat: Infinity }}
  />
) : null}
```

La pastilla usa una rama de clases azul solo cuando `isActiveDoing` es verdadero.

- [ ] **Step 4: Verificar GREEN y regresiones**

Run: `npm.cmd test -- "src/app/(app)/proyectos/_components/__tests__/ProjectCard.test.tsx"`

Expected: PASS en todas las pruebas del componente.

Run: `npm.cmd test && npx.cmd tsc --noEmit && npm.cmd run build`

Expected: toda la suite, tipos y build terminan con código 0.

- [ ] **Step 5: Revisar visualmente y publicar**

Verificar `/proyectos` en escritorio y móvil, confirmar consola limpia, luego hacer commit y push tanto a `codex/elabela-functional-upgrades` como a `main`.

