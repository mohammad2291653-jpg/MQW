import { test, expect } from "@playwright/test";
test("Arabic private shell, honest empty state, settings and mobile layout", async ({
  page,
}) => {
  const stamp = Date.now();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/sign-up");
  await page.getByLabel("بماذا نُناديك؟").fill("تجربة");
  await page.getByLabel("البريد الإلكتروني").fill(`root-${stamp}@mqw.test`);
  await page
    .getByLabel("كلمة المرور", { exact: true })
    .fill("TestOnly-StrongPassword-2026");
  await page.getByRole("button", { name: "أنشئ مساحتك" }).click();
  await expect(page).toHaveURL(/\/today/);
  await expect(
    page.getByRole("heading", { name: /تعلّم أقل عشوائية/ }),
  ).toBeVisible();
  await expect(page.locator(".home-lesson")).toHaveCount(4);
  await page.screenshot({
    path: "artifacts/today-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "البحث في مساحتك" }).click();
  await page.getByRole("searchbox").fill("تعلّم");
  await expect(
    page.getByRole("dialog").getByText("تعلّم", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/progress");
  await expect(
    page.getByRole("heading", { name: "تقدّمك يبدأ بمحاولة." }),
  ).toBeVisible();
  await expect(page.getByText("ما زلنا نتعرّف إلى نتائجك")).toBeVisible();
  await page.goto("/settings/preferences");
  await page.getByLabel("منطقتك الزمنية").selectOption("Asia/Riyadh");
  await page.getByRole("button", { name: "احفظ تفضيلاتي" }).click();
  await expect(page.getByRole("status")).toContainText("حُفظت");
  await page.reload();
  await expect(page.getByLabel("منطقتك الزمنية")).toHaveValue("Asia/Riyadh");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/today", "/learn", "/progress", "/settings/privacy"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/today");
  await expect(
    page.getByRole("heading", { name: /تعلّم أقل عشوائية/ }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "artifacts/today-mobile.png", fullPage: true });
  await expect(
    page.getByRole("navigation", { name: "التنقل الرئيسي للهاتف" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  const result = await page.request.delete("/api/account", {
    headers: { Origin: new URL(page.url()).origin },
    data: { password: "TestOnly-StrongPassword-2026" },
  });
  expect(result.ok()).toBe(true);
});
