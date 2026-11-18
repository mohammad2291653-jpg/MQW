import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
test("primary Arabic screens meet automated WCAG checks", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120000);
  const password = "Accessibility-Test-2026";
  const origin = baseURL || "http://localhost:3000";
  const signup = await context.request.post("/api/auth", {
    headers: { Origin: origin },
    data: {
      action: "sign-up",
      email: `a11y-${Date.now()}@mqw.test`,
      password,
      name: "تجربة الوصول",
    },
  });
  expect(signup.ok()).toBeTruthy();
  const report: unknown[] = [];
  try {
    for (const route of [
      "/today",
      "/learn",
      "/palace",
      "/space",
      "/progress",
      "/settings/privacy",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      report.push({
        route,
        checkedAt: new Date().toISOString(),
        violations: result.violations,
      });
      expect(
        result.violations,
        `${route}: ${result.violations.map((v) => v.id).join(", ")}`,
      ).toEqual([]);
    }
    mkdirSync("artifacts", { recursive: true });
    writeFileSync(
      "artifacts/accessibility-audit.json",
      JSON.stringify(report, null, 2),
    );
  } finally {
    await context.request.delete("/api/account", {
      headers: { Origin: origin },
      data: { password },
    });
  }
});
