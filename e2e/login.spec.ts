import { test, expect } from "@playwright/test";

test("la página de login muestra la marca ElaBela", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "ElaBela" })).toBeVisible();
  await expect(page.getByPlaceholder("tu usuario")).toBeVisible();
  await expect(page.getByRole("button", { name: /ingresar/i })).toBeVisible();
});

test("la raíz sin sesión redirige al login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("el acceso rápido completa el usuario", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "bryan" }).click();
  await expect(page.getByPlaceholder("tu usuario")).toHaveValue("bryan");
});
