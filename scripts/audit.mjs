import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await ctx.newPage();
const base = "http://localhost:3000",
  password = "Accessibility-Test-2026";
const response = await ctx.request.post(base + "/api/auth", {
  headers: { Origin: base },
  data: {
    action: "sign-up",
    email: `audit-${Date.now()}@mqw.test`,
    password,
    name: "تجربة",
  },
});
if (!response.ok()) throw new Error(await response.text());
try {
  for (const route of [
    "/today",
    "/learn",
    "/palace",
    "/space",
    "/progress",
    "/settings/privacy",
  ]) {
    await page.goto(base + route);
    await page.locator("main h1").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    console.log(
      JSON.stringify({
        route,
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes
            .slice(0, 12)
            .map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      }),
    );
  }
} finally {
  await ctx.request.delete(base + "/api/account", {
    headers: { Origin: base },
    data: { password },
  });
  await browser.close();
}
