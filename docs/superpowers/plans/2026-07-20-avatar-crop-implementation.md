# Avatar Crop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que la foto personal y las fotos administradas del equipo se encuadren con arrastre y zoom antes de guardar, sin mostrar cambios que Supabase no haya confirmado.

**Architecture:** Separar geometría/canvas en `src/lib/avatar-crop.ts`, mantener un único modal compartido en `PerfilView` y hacer que `ProfilesProvider.setAvatar` persista antes de actualizar el contexto. El archivo original vive únicamente durante la sesión del modal y todos los `object URL` se revocan.

**Tech Stack:** React 19, TypeScript, Canvas 2D, Pointer Events, Supabase JS, modal existente de ElaBela, Vitest + Testing Library.

## Global Constraints

- Conservar el diseño actual de Perfil y reutilizar `Modal` de `src/components/ui.tsx`.
- Aceptar únicamente JPEG, PNG y WebP de hasta 8 MB.
- Rechazar imágenes corruptas o sin dimensiones válidas antes de habilitar Guardar.
- Recorte cuadrado, zoom entre `1` y `3`, arrastre limitado sin franjas vacías y vista previa circular.
- Exportar exactamente 256 × 256 píxeles como `image/jpeg` con calidad `0.82`.
- Usar el mismo modal para la foto personal y las filas de administración.
- Cancelar nunca cambia el avatar existente.
- Guardar actualiza el contexto solo después de una respuesta Supabase confirmada.
- Un fallo conserva avatar anterior, archivo, posición y zoom; el modal queda abierto para reintentar.
- Revocar cada `object URL` al reemplazar archivo, cancelar, guardar o desmontar.
- No guardar el archivo original, no crear tablas/buckets y no añadir dependencias.
- Mantener la acción Quitar foto y hacerla resistente a errores de persistencia.
- Seguir RED → GREEN → REFACTOR y terminar cada tarea con un commit revisable.

---

## File Structure

- Create: `src/lib/avatar-crop.ts` — validación, límites, geometría y exportación canvas.
- Create: `src/lib/__tests__/avatar-crop.test.ts` — formatos, geometría y salida.
- Modify: `src/lib/profiles.tsx` — persistencia confirmada y eliminación de `fileToAvatar`.
- Create: `src/lib/__tests__/profiles.test.tsx` — éxito, fallo y estado local.
- Create: `src/components/AvatarCropModal.tsx` — interacción compartida.
- Create: `src/components/__tests__/AvatarCropModal.test.tsx` — carga, zoom, teclado, cancelar y reintento.
- Modify: `src/components/views/PerfilView.tsx` — una sesión de recorte para ambos disparadores.
- Create: `src/components/__tests__/PerfilView.test.tsx` — target correcto, quitar foto y error visible.

### Task 1: Pure avatar validation and crop geometry

**Files:**
- Create: `src/lib/avatar-crop.ts`
- Create: `src/lib/__tests__/avatar-crop.test.ts`

**Interfaces:**
- Produces: constants, `AvatarCrop`, `AvatarDimensions`, `validateAvatarFile`, `clampAvatarCrop`, `panAvatarCrop`, `getAvatarSourceRect`, `exportAvatarCrop`.
- Consumes: browser Canvas only inside `exportAvatarCrop`.

- [ ] **Step 1: Write the failing validation and geometry tests**

Create `src/lib/__tests__/avatar-crop.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AVATAR_MAX_BYTES,
  AVATAR_OUTPUT_QUALITY,
  AVATAR_OUTPUT_SIZE,
  clampAvatarCrop,
  exportAvatarCrop,
  getAvatarSourceRect,
  panAvatarCrop,
  validateAvatarFile,
} from "@/lib/avatar-crop";

describe("avatar crop", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s", (type) => {
    expect(validateAvatarFile({ type, size: AVATAR_MAX_BYTES })).toBeNull();
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf"])("rejects %s", (type) => {
    expect(validateAvatarFile({ type, size: 10 })).toMatch(/JPG, PNG o WebP/);
  });

  it("rejects a file larger than 8 MB", () => {
    expect(validateAvatarFile({ type: "image/jpeg", size: AVATAR_MAX_BYTES + 1 })).toMatch(/8 MB/);
  });

  it("clamps zoom and normalized offsets", () => {
    expect(clampAvatarCrop({ x: 4, y: -4, zoom: 8 })).toEqual({ x: 1, y: -1, zoom: 3 });
  });

  it("maps normalized offsets to a valid square source rectangle", () => {
    expect(getAvatarSourceRect({ width: 1200, height: 800 }, { x: -1, y: 1, zoom: 2 })).toEqual({
      sx: 0, sy: 400, side: 400,
    });
    expect(getAvatarSourceRect({ width: 800, height: 1200 }, { x: 1, y: -1, zoom: 2 })).toEqual({
      sx: 400, sy: 0, side: 400,
    });
  });

  it("converts pointer movement into bounded crop movement", () => {
    expect(panAvatarCrop({ x: 0, y: 0, zoom: 1 }, { x: 300, y: -300 }, 300)).toEqual({ x: -1, y: 1, zoom: 1 });
  });

  it("exports a 256 square JPEG at quality 0.82", () => {
    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => "data:image/jpeg;base64,result");
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toDataURL };
    vi.spyOn(document, "createElement").mockReturnValue(canvas as unknown as HTMLCanvasElement);
    const image = { naturalWidth: 1200, naturalHeight: 800 } as HTMLImageElement;
    expect(exportAvatarCrop(image, { x: 0, y: 0, zoom: 1 })).toBe("data:image/jpeg;base64,result");
    expect(canvas).toMatchObject({ width: AVATAR_OUTPUT_SIZE, height: AVATAR_OUTPUT_SIZE });
    expect(drawImage).toHaveBeenCalledWith(image, 200, 0, 800, 800, 0, 0, 256, 256);
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", AVATAR_OUTPUT_QUALITY);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/lib/__tests__/avatar-crop.test.ts`

Expected: FAIL because `@/lib/avatar-crop` does not exist.

- [ ] **Step 3: Implement the exact pure API**

Create `src/lib/avatar-crop.ts`:

```ts
export type AvatarCrop = { x: number; y: number; zoom: number };
export type AvatarDimensions = { width: number; height: number };
export type AvatarSourceRect = { sx: number; sy: number; side: number };

export const AVATAR_MAX_BYTES = 8 * 1024 * 1024;
export const AVATAR_OUTPUT_SIZE = 256;
export const AVATAR_OUTPUT_QUALITY = 0.82;
export const AVATAR_MIN_ZOOM = 1;
export const AVATAR_MAX_ZOOM = 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function validateAvatarFile(file: Pick<File, "type" | "size">): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Elegí una imagen JPG, PNG o WebP.";
  }
  if (file.size > AVATAR_MAX_BYTES) return "La imagen debe pesar como máximo 8 MB.";
  return null;
}

export function clampAvatarCrop(crop: AvatarCrop): AvatarCrop {
  return {
    x: clamp(crop.x, -1, 1),
    y: clamp(crop.y, -1, 1),
    zoom: clamp(crop.zoom, AVATAR_MIN_ZOOM, AVATAR_MAX_ZOOM),
  };
}

export function panAvatarCrop(crop: AvatarCrop, delta: { x: number; y: number }, viewportSize: number): AvatarCrop {
  const half = Math.max(1, viewportSize / 2);
  return clampAvatarCrop({ ...crop, x: crop.x - delta.x / half, y: crop.y - delta.y / half });
}

export function getAvatarSourceRect(dimensions: AvatarDimensions, crop: AvatarCrop): AvatarSourceRect {
  const safe = clampAvatarCrop(crop);
  if (dimensions.width <= 0 || dimensions.height <= 0) throw new Error("La imagen no tiene dimensiones válidas.");
  const side = Math.min(dimensions.width, dimensions.height) / safe.zoom;
  const maxX = dimensions.width - side;
  const maxY = dimensions.height - side;
  return {
    sx: maxX * ((safe.x + 1) / 2),
    sy: maxY * ((safe.y + 1) / 2),
    side,
  };
}

export function exportAvatarCrop(image: HTMLImageElement, crop: AvatarCrop): string {
  const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
  const { sx, sy, side } = getAvatarSourceRect(dimensions, crop);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar el recorte.");
  context.drawImage(image, sx, sy, side, side, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
  return canvas.toDataURL("image/jpeg", AVATAR_OUTPUT_QUALITY);
}
```

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- src/lib/__tests__/avatar-crop.test.ts`

Expected: PASS, 8 tests.

```powershell
git add src/lib/avatar-crop.ts src/lib/__tests__/avatar-crop.test.ts
git commit -m "feat: add avatar crop geometry"
```

### Task 2: Confirmed profile-avatar persistence

**Files:**
- Modify: `src/lib/profiles.tsx:27-84,115-136`
- Create: `src/lib/__tests__/profiles.test.tsx`

**Interfaces:**
- Produces: `setAvatar(id, avatar): Promise<void>` that rejects on zero-row/error and mutates context only after success.
- Consumes: existing `profiles.avatar` text column.

- [ ] **Step 1: Write failing provider tests**

Mock the Supabase fluent query and render a probe using `useProfiles()`:

```tsx
it("keeps the previous avatar until Supabase confirms the update", async () => {
  const deferred = createDeferred<{ data: { id: string } | null; error: null }>();
  supabaseUpdateResult.mockReturnValueOnce(deferred.promise);
  render(<ProviderProbe />);
  fireEvent.click(screen.getByRole("button", { name: "Cambiar avatar" }));
  expect(screen.getByTestId("avatar")).toHaveTextContent("anterior");
  deferred.resolve({ data: { id: "profile-1" }, error: null });
  await waitFor(() => expect(screen.getByTestId("avatar")).toHaveTextContent("nuevo"));
});

it("rejects and preserves the previous avatar when persistence fails", async () => {
  supabaseUpdateResult.mockResolvedValueOnce({ data: null, error: { message: "sin conexión" } });
  render(<ProviderProbe />);
  fireEvent.click(screen.getByRole("button", { name: "Cambiar avatar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar el avatar");
  expect(screen.getByTestId("avatar")).toHaveTextContent("anterior");
});
```

The mocked chain must implement `.from().update().eq().select().maybeSingle()` and the initial `.from().select().then()` used by `refresh`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/__tests__/profiles.test.tsx`

Expected: FAIL because the provider changes local state before awaiting and ignores Supabase errors.

- [ ] **Step 3: Persist first and update context second**

Replace the body of `setAvatar` with:

```ts
setAvatar: async (id, avatar) => {
  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("No se pudo guardar el avatar.");
  setProfiles((current) => current.map((profile) =>
    profile.id === id ? { ...profile, avatar: avatar || undefined } : profile,
  ));
},
```

Delete `fileToAvatar`; keep `fileToImage` because other modules may consume it.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- src/lib/__tests__/profiles.test.tsx`

Expected: PASS.

Run: `npm test`

Expected: all suites pass.

```powershell
git add src/lib/profiles.tsx src/lib/__tests__/profiles.test.tsx
git commit -m "fix: confirm avatar persistence"
```

### Task 3: Shared accessible crop modal

**Files:**
- Create: `src/components/AvatarCropModal.tsx`
- Create: `src/components/__tests__/AvatarCropModal.test.tsx`

**Interfaces:**
- Consumes: Task 1 geometry and existing `Modal`.
- Produces: `AvatarCropModalProps` below.

```ts
export type AvatarCropModalProps = {
  file: File | null;
  username: string;
  onCancel: () => void;
  onSave: (avatarDataUrl: string) => Promise<void>;
};
```

- [ ] **Step 1: Write failing modal tests**

Create tests with mocked `URL.createObjectURL`, `URL.revokeObjectURL`, `Image`, and `exportAvatarCrop`:

```tsx
it("loads a valid file with neutral crop and accessible controls", async () => {
  render(<AvatarCropModal file={jpegFile} username="bryan" onCancel={vi.fn()} onSave={vi.fn()} />);
  expect(await screen.findByRole("dialog", { name: /Ajustar foto de Bryan/i })).toBeInTheDocument();
  expect(screen.getByRole("slider", { name: "Zoom" })).toHaveValue(1);
  expect(screen.getByLabelText("Vista previa circular")).toBeInTheDocument();
});

it("changes zoom and supports arrow-key positioning", async () => {
  render(<AvatarCropModal file={jpegFile} username="bryan" onCancel={vi.fn()} onSave={vi.fn()} />);
  const zoom = await screen.findByRole("slider", { name: "Zoom" });
  fireEvent.change(zoom, { target: { value: "2" } });
  const crop = screen.getByLabelText("Área de recorte de avatar");
  fireEvent.keyDown(crop, { key: "ArrowRight" });
  expect(crop).toHaveAttribute("data-crop-x", "-0.05");
});

it("cancels without saving and revokes the object URL", async () => {
  const onCancel = vi.fn();
  const onSave = vi.fn();
  render(<AvatarCropModal file={jpegFile} username="bryan" onCancel={onCancel} onSave={onSave} />);
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onSave).not.toHaveBeenCalled();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:avatar");
});

it("blocks double save and remains open with the same crop on persistence failure", async () => {
  const onSave = vi.fn().mockRejectedValue(new Error("No se pudo guardar"));
  render(<AvatarCropModal file={jpegFile} username="bryan" onCancel={vi.fn()} onSave={onSave} />);
  const save = await screen.findByRole("button", { name: "Guardar foto" });
  fireEvent.click(save);
  fireEvent.click(save);
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
});

it("reports a corrupt image and disables save", async () => {
  imageDecodeFails();
  render(<AvatarCropModal file={jpegFile} username="bryan" onCancel={vi.fn()} onSave={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo leer la imagen");
  expect(screen.getByRole("button", { name: "Guardar foto" })).toBeDisabled();
});
```

- [ ] **Step 2: Verify modal RED**

Run: `npm test -- src/components/__tests__/AvatarCropModal.test.tsx`

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement resource ownership and image loading**

The component validates the file before creating a URL. On each non-null file, create exactly one `object URL`, load it into one `Image`, require positive `naturalWidth/naturalHeight`, and initialize `{x:0,y:0,zoom:1}`. The effect cleanup revokes that exact URL. Store the image element in a ref, not React state.

Use a synchronous `savingRef` in addition to `saving` state so two clicks in the same tick call `onSave` once. The modal awaits `onSave(dataUrl)` but does not invoke `onCancel` on success: the parent owns closing by clearing its target after persistence succeeds. On rejection, set a visible error and keep the modal open.

- [ ] **Step 4: Implement pointer, keyboard, zoom and previews**

Render the existing `Modal` with title `Ajustar foto de ${username}`. The square crop surface has `tabIndex={0}`, `aria-label="Área de recorte de avatar"`, `data-crop-x`, `data-crop-y`, pointer handlers, and arrow keys that move by `0.05` normalized units through `panAvatarCrop`. Use pointer capture during drag and derive deltas from the previous pointer position.

Render an `<input type="range" min="1" max="3" step="0.05" aria-label="Zoom">`. Both the square surface and circular preview show the same source image and transform. Footer buttons are `Cancelar` and `Guardar foto`; disable save until the image is valid and while saving. Errors use `role="alert"`.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- src/components/__tests__/AvatarCropModal.test.tsx src/lib/__tests__/avatar-crop.test.ts`

Expected: PASS.

```powershell
git add src/components/AvatarCropModal.tsx src/components/__tests__/AvatarCropModal.test.tsx
git commit -m "feat: add shared avatar crop modal"
```

### Task 4: Integrate personal and administrative avatar flows

**Files:**
- Modify: `src/components/views/PerfilView.tsx:3-12,36-156,161-385`
- Create: `src/components/__tests__/PerfilView.test.tsx`

**Interfaces:**
- Consumes: `AvatarCropModal` and confirmed `setAvatar`.
- Produces: one `AvatarCropTarget` session for every upload trigger.

```ts
type AvatarCropTarget = {
  id: string;
  username: string;
  file: File;
};
```

- [ ] **Step 1: Write failing integration tests**

Mock profile/admin actions and `useProfiles` and add:

```tsx
it("opens the shared cropper for the personal photo and saves the current profile ID", async () => {
  render(<PerfilView id="self-id" fullName="Bryan" username="bryan" role="admin" />);
  fireEvent.change(screen.getByLabelText("Archivo para foto de perfil"), { target: { files: [jpegFile] } });
  expect(await screen.findByRole("dialog", { name: /Ajustar foto de bryan/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar foto" }));
  await waitFor(() => expect(setAvatar).toHaveBeenCalledWith("self-id", "data:image/jpeg;base64,crop"));
});

it("uses the same cropper and correct ID for an administrative row", async () => {
  render(<PerfilView id="self-id" fullName="Bryan" username="bryan" role="admin" />);
  fireEvent.change(await screen.findByLabelText("Archivo para foto de @cielo"), { target: { files: [jpegFile] } });
  expect(await screen.findByRole("dialog", { name: /Ajustar foto de cielo/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar foto" }));
  await waitFor(() => expect(setAvatar).toHaveBeenCalledWith("cielo-id", "data:image/jpeg;base64,crop"));
});

it("keeps the cropper open and reports a failed save", async () => {
  setAvatar.mockRejectedValueOnce(new Error("No se pudo guardar el avatar."));
  render(<PerfilView id="self-id" fullName="Bryan" username="bryan" role="admin" />);
  fireEvent.change(screen.getByLabelText("Archivo para foto de perfil"), { target: { files: [jpegFile] } });
  fireEvent.click(await screen.findByRole("button", { name: "Guardar foto" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("reports a failed remove without changing the visible avatar", async () => {
  setAvatar.mockRejectedValueOnce(new Error("No se pudo guardar el avatar."));
  render(<PerfilView id="self-id" fullName="Bryan" username="bryan" role="admin" />);
  fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo quitar la foto");
});
```

- [ ] **Step 2: Verify integration RED**

Run: `npm test -- src/components/__tests__/PerfilView.test.tsx`

Expected: FAIL because both current upload components call `fileToAvatar` directly.

- [ ] **Step 3: Lift one crop session into `PerfilView`**

Add `const [avatarTarget, setAvatarTarget] = useState<AvatarCropTarget | null>(null)`. Change `ProfilePhoto` and `RowAvatarButton` so they only validate file selection and call `onSelectFile({id, username, file})`; remove their local conversion and save logic. Use `accept="image/jpeg,image/png,image/webp"` and accessible labels `Archivo para foto de perfil` / `Archivo para foto de @username` on the hidden inputs.

Render exactly one modal near the end of `PerfilView`:

```tsx
<AvatarCropModal
  file={avatarTarget?.file ?? null}
  username={avatarTarget?.username ?? ""}
  onCancel={() => setAvatarTarget(null)}
  onSave={async (dataUrl) => {
    if (!avatarTarget) return;
    await setAvatar(avatarTarget.id, dataUrl);
    setAvatarTarget(null);
  }}
/>
```

Do not clear `avatarTarget` inside a catch. Let `AvatarCropModal` display the error and retain the session. Catch errors from `setAvatar(id, "")` in Quitar foto and show `No se pudo quitar la foto. Probá de nuevo.`.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- src/components/__tests__/PerfilView.test.tsx src/components/__tests__/AvatarCropModal.test.tsx src/lib/__tests__/profiles.test.tsx`

Expected: PASS.

Run: `npm test`

Expected: all suites pass.

```powershell
git add src/components/views/PerfilView.tsx src/components/__tests__/PerfilView.test.tsx
git commit -m "feat: crop profile photos before save"
```

### Task 5: Integrated verification, browser QA, review, and push

**Files:**
- Review: every file listed above
- Review: `docs/superpowers/specs/2026-07-20-projects-ai-avatar-crop-design.md`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: a verified avatar block on both remote branches.

- [ ] **Step 1: Run complete automated checks sequentially**

```powershell
npm test
npm run build
npx tsc --noEmit
npm run test:e2e
```

Expected: all Vitest suites pass, production build exits 0, TypeScript exits 0 and existing Playwright tests pass. Do not run build and TypeScript simultaneously because both use `.next/types`.

- [ ] **Step 2: Verify with the authenticated local browser**

On `http://localhost:59174/perfil`, use a non-sensitive local test image and check personal upload, drag, zoom, circular preview, cancel, save, reload persistence, administrative-row upload and remove. Do not expose or store the user's password in test code, environment files or memory. If authentication is absent, ask the user to sign in rather than embedding credentials.

- [ ] **Step 3: Inspect resource and secret safety**

```powershell
rg -n "fileToAvatar|image/gif|image/svg\+xml" src/lib/profiles.tsx src/components/views/PerfilView.tsx src/components/AvatarCropModal.tsx
git diff --check
git status --short
```

Expected: `fileToAvatar` is absent; GIF/SVG are not accepted by the avatar flow; no whitespace errors; only intended files changed.

- [ ] **Step 4: Independent two-stage review**

Dispatch one reviewer for spec compliance and another for code quality/accessibility. Resolve Critical and Important findings through a new failing test, then repeat Steps 1–3.

- [ ] **Step 5: Push branch and fast-forward main**

```powershell
git push -u origin codex/elabela-functional-upgrades
git merge-base --is-ancestor origin/main HEAD
git push origin HEAD:main
git ls-remote origin refs/heads/main refs/heads/codex/elabela-functional-upgrades
```

Expected: both refs equal the reviewed HEAD and Vercel receives the same commit.
