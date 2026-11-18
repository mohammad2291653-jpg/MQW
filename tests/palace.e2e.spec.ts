import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.use({ hasTouch: true });
const origin =
  process.env.MQW_BASE_URL ??
  process.env.MQW_TEST_URL ??
  "http://localhost:3000";
const places = [
  { id: "entrance", name: "المدخل" },
  { id: "hallway", name: "الممر" },
  { id: "living-room", name: "غرفة الجلوس" },
  { id: "kitchen", name: "المطبخ" },
  { id: "library", name: "المكتبة" },
];

async function syntheticAccount(page: Page, prefix: string) {
  const response = await page.request.post(`${origin}/api/auth`, {
    headers: { Origin: origin },
    data: {
      action: "sign-up",
      email: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
      password: "Synthetic-private-password-123",
      name: "اختبار القصر",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  await page.request.patch(`${origin}/api/preferences`, {
    headers: { Origin: origin },
    data: { onboardingDone: true },
  });
}

test("desktop palace: tour, all five associations, concealed recall, resume, honest skip and later recurring review", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await syntheticAccount(page, "palace-desktop");
  await page.goto(`${origin}/palace`);
  await expect(
    page.getByRole("heading", { name: "مكانٌ لكل معلومة." }),
  ).toBeVisible();
  await expect(page.locator(".palace-map-pin")).toHaveCount(5);
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "artifacts/palace.png", fullPage: true });
  await page.getByRole("button", { name: "جولة إرشادية" }).click();
  for (let i = 0; i < 4; i++)
    await page
      .getByRole("button", { name: "المكان التالي", exact: true })
      .click();
  await page.getByRole("button", { name: "أنهِ الجولة", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "اكتملت جولتك" }),
  ).toBeVisible();

  for (const [index, place] of places.entries()) {
    const pin = page.getByRole("button", {
      name: `${index + 1}. ${place.name}`,
      exact: true,
    });
    await pin.focus();
    await pin.press("Enter");
    await page
      .getByRole("button", { name: "أضف رابطًا ذهنيًا", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "اصنع صورةً تتذكّرها." });
    await expect(dialog).toBeVisible();
    await dialog
      .getByLabel("المعلومة التي أريد تذكّرها")
      .fill(`QA-SECRET-FACT-${place.id}`);
    await dialog
      .getByLabel("الصورة الذهنية أو القصة")
      .fill(`QA-SECRET-MNEMONIC-${place.id}`);
    await dialog
      .getByRole("button", { name: "احفظ الرابط", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
  }
  await page
    .getByRole("button", { name: "1. المدخل، مرتبط بمعلومة", exact: true })
    .click();
  await page
    .getByRole("button", { name: "تعديل رابط المدخل", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("المعلومة التي أريد تذكّرها")
    .fill("UNSAVED-DRAFT");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "اصنع صورةً تتذكّرها." }),
  ).not.toBeVisible();
  await expect(
    page.getByText("QA-SECRET-FACT-entrance", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "ابدأ استرجاع المعلومات", exact: true })
    .click();
  const trial = page.getByRole("region", { name: "اختبار الاسترجاع" });
  await expect(trial).toBeVisible();
  await expect(page.locator("body")).not.toContainText("QA-SECRET-FACT");
  await expect(page.locator("body")).not.toContainText("QA-SECRET-MNEMONIC");
  await page
    .getByRole("textbox", { name: "محاولتك", exact: true })
    .fill("استرجاعي الأول قبل الكشف");
  await page.getByRole("button", { name: "احفظ محاولتي", exact: true }).click();
  await expect(page.getByText("محاولتك محفوظة", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("QA-SECRET-FACT");
  await page.reload();
  await page
    .getByRole("button", { name: "متابعة الاختبار", exact: true })
    .click();
  await expect(
    page.getByText("استرجاعي الأول قبل الكشف", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "اكشف المعلومة للمقارنة", exact: true })
    .click();
  await expect(
    page.getByText("QA-SECRET-FACT-entrance", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("QA-SECRET-MNEMONIC");
  await page.getByRole("button", { name: "تذكّرت بوضوح", exact: true }).click();
  await page
    .getByRole("button", { name: "الموقع التالي", exact: true })
    .click();

  await expect(page.locator("body")).not.toContainText("QA-SECRET-FACT");
  await page
    .getByRole("textbox", { name: "محاولتك", exact: true })
    .fill("أتذكر جزءًا من الفكرة");
  await page.getByRole("button", { name: "احفظ محاولتي", exact: true }).click();
  await page
    .getByRole("button", { name: "اكشف المعلومة للمقارنة", exact: true })
    .click();
  await page.getByRole("button", { name: "تذكّرت جزءًا", exact: true }).click();
  await page
    .getByRole("button", { name: "الموقع التالي", exact: true })
    .click();
  await page
    .getByRole("button", { name: "تخطّ هذا الموقع", exact: true })
    .click();
  await expect(
    page.getByText("سُجّل كتخطٍّ، ولم يُحسب إجابة صحيحة أو خاطئة.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "الموقع التالي", exact: true })
    .click();
  await page
    .getByRole("button", { name: "لا أتذكّر، أكشف الإجابة", exact: true })
    .click();
  await page.getByRole("button", { name: "لم أتذكّر", exact: true }).click();
  await page
    .getByRole("button", { name: "الموقع التالي", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "محاولتك", exact: true })
    .fill("المعلومة الخامسة");
  await page.getByRole("button", { name: "احفظ محاولتي", exact: true }).click();
  await page
    .getByRole("button", { name: "اكشف المعلومة للمقارنة", exact: true })
    .click();
  await page.getByRole("button", { name: "تذكّرت بوضوح", exact: true }).click();
  await page.getByRole("button", { name: "بعد 3 أيام", exact: true }).click();
  await page
    .getByRole("button", { name: "أنهِ الاختبار واحفظ المراجعة", exact: true })
    .click();
  await expect(
    page.locator(".palace-result-metrics strong").first(),
  ).toHaveText("2/4");
  await expect(
    page.getByText(
      "هذه نتائج تقييمك الذاتي بعد المقارنة، وليست تصحيحًا آليًا لفهمك.",
      { exact: true },
    ),
  ).toBeVisible();
  const firstState = (
    await (await page.request.get(`${origin}/api/state`)).json()
  ).data;
  const firstTrial = firstState.palaceTrials[0];
  expect(firstTrial.results).toHaveLength(5);
  expect(
    firstTrial.results.filter(
      (result: { skipped?: boolean }) => result.skipped,
    ),
  ).toHaveLength(1);
  expect(firstTrial.status).toBe("completed");
  expect(
    firstState.reviews.filter(
      (card: { target: string }) => card.target === "palace",
    ),
  ).toHaveLength(1);

  // Bring the recorded review due through the real rescheduling action, then revisit it.
  const card = firstState.reviews.find(
    (item: { target: string }) => item.target === "palace",
  );
  const rescheduled = await page.request.post(`${origin}/api/reviews`, {
    headers: { Origin: origin },
    data: {
      action: "reschedule",
      cardId: card.id,
      dueAt: new Date().toISOString(),
    },
  });
  expect(rescheduled.ok()).toBeTruthy();
  await page.goto(`${origin}/reviews`);
  await page.getByRole("link", { name: /إلى القصر/ }).click();
  await page
    .getByRole("button", { name: "ابدأ استرجاع المعلومات", exact: true })
    .click();
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: "تخطّ هذا الموقع", exact: true })
      .click();
    if (i < 4)
      await page
        .getByRole("button", { name: "الموقع التالي", exact: true })
        .click();
  }
  await page
    .getByRole("button", { name: "أنهِ الاختبار واحفظ المراجعة", exact: true })
    .click();
  await expect(
    page.locator(".palace-result-metrics strong").first(),
  ).toHaveText("0/0");
  const secondState = (
    await (await page.request.get(`${origin}/api/state`)).json()
  ).data;
  expect(
    secondState.palaceTrials.filter(
      (item: { status: string }) => item.status === "completed",
    ),
  ).toHaveLength(2);
  expect(
    secondState.reviews.filter(
      (item: { target: string }) => item.target === "palace",
    ),
  ).toHaveLength(1);
  expect(
    secondState.reviewEvents.filter(
      (item: { kind: string }) => item.kind === "attempt",
    ),
  ).toHaveLength(1);
  expect(Date.parse(secondState.palaceTrials[0].completedAt)).toBeGreaterThan(
    Date.parse(firstTrial.completedAt),
  );
});

test("mobile palace: fits narrow screen, keyboard/tap map and independently scored route quiz", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await syntheticAccount(page, "palace-mobile");
  await page.goto(`${origin}/palace`);
  await expect(
    page.getByRole("heading", { name: "مكانٌ لكل معلومة." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  const mapPin = page.getByRole("button", { name: "4. المطبخ", exact: true });
  await mapPin.tap();
  await expect(
    page.getByRole("complementary", { name: "المكان المحدد: المطبخ" }),
  ).toBeVisible();
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "artifacts/palace-mobile.png",
    fullPage: false,
  });
  await page
    .getByRole("button", { name: "اختبر ترتيب الطريق فقط", exact: true })
    .click();
  await expect(page.locator(".palace-map")).toHaveCount(0);
  await expect(page.locator(".palace-route-list")).toHaveCount(0);
  await expect(page.locator(".palace-route-choices button")).toHaveCount(5);
  const routeChoices = ["المدخل", "المكتبة", null, "المطبخ", "المكتبة"];
  for (let i = 0; i < routeChoices.length; i++) {
    if (routeChoices[i]) {
      await page
        .getByRole("button", { name: routeChoices[i]!, exact: true })
        .click();
      await page
        .getByRole("button", { name: "احفظ محاولتي", exact: true })
        .click();
      await expect(
        page.getByText("المكان الصحيح", { exact: true }),
      ).toBeVisible();
    } else
      await page
        .getByRole("button", { name: "تخطّ هذا الموقع", exact: true })
        .click();
    if (i < routeChoices.length - 1)
      await page
        .getByRole("button", { name: "الموقع التالي", exact: true })
        .click();
  }
  await page
    .getByRole("button", { name: "أنهِ الاختبار واحفظ المراجعة", exact: true })
    .click();
  await expect(
    page.locator(".palace-result-metrics strong").first(),
  ).toHaveText("3/4");
  await expect(
    page.getByText(
      "هذه نتائج اختياراتك لترتيب الأماكن، وليست قياسًا لتذكّر المعلومات.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
