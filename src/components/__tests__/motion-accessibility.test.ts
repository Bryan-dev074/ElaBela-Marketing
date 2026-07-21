import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

describe("shared reduced-motion CSS", () => {
  it("keeps the card sheen transition at or below 300 ms", () => {
    const rule = css.match(/\.card-sheen::after\s*{(?<body>[^}]*)}/s)?.groups?.body ?? "";
    const duration = Number(rule.match(/transition:\s*transform\s+([\d.]+)s/)?.[1]);

    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThanOrEqual(0.3);
  });

  it("removes the card sheen decoration under reduced motion", () => {
    const reducedMotion = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

    expect(reducedMotion).toMatch(/\.card-sheen::after\s*{[^}]*content:\s*none/s);
    expect(reducedMotion).toMatch(/\.card-sheen::after\s*{[^}]*transform:\s*none/s);
  });

  it("removes press transforms under reduced motion", () => {
    const reducedMotion = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));

    expect(reducedMotion).toMatch(/\.press:active\s*{[^}]*transform:\s*none/s);
  });
});
