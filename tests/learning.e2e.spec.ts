import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "Synthetic-MQW-Only-4729";
test.use({ actionTimeout: 15000 });
test.afterEach(async ({ context }) => {
  await context.request.delete(`${ORIGIN}/api/account`, {
    headers: { Origin: ORIGIN },
    data: { password: PASSWORD },
  });
});
async function newAccount(context: BrowserContext) {
  const email = `learning-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const result = await context.request.post(`${ORIGIN}/api/auth`, {
    headers: { Origin: ORIGIN },
    data: { action: "sign-up", email, password: PASSWORD, name: "تجربة تعلّم" },
  });
  expect(result.ok(), await result.text()).toBeTruthy();
  const preferences = await context.request.patch(`${ORIGIN}/api/preferences`, {
    headers: { Origin: ORIGIN },
    data: { onboardingDone: true },
  });
  expect(preferences.ok()).toBeTruthy();
}
async function state(context: BrowserContext) {
  const result = await context.request.get(`${ORIGIN}/api/state`);
  expect(result.ok()).toBeTruthy();
  return (await result.json()).data;
}
async function startLesson(page: Page, slug: string) {
  await page.goto(`${ORIGIN}/learn/${slug}`);
  await page.getByRole("button", { name: "ابدأ التجربة", exact: true }).click();
  await page.getByRole("button", { name: /أخْفِ المصدر وابدأ/ }).click();
}
async function submitChoice(page: Page, label: string) {
  await page.getByLabel(label, { exact: true }).check();
  await page
    .getByRole("button", { name: "احفظ إجابتي وتحقّق", exact: true })
    .click();
  await expect(
    page.getByText("إجابة صحيحة · تقييم آلي محدد", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "تابع التجربة", exact: true }).click();
}
async function complete(page: Page) {
  await page
    .getByRole("button", { name: "أكمل واحفظ موعد المراجعة", exact: true })
    .click();
  await expect(page.getByText("اكتمل وحُفظ", { exact: true })).toBeVisible();
}

test("L1 persists draft, recoverable save failure, results, review, and immutable retry history", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await newAccount(context);
  await startLesson(page, "familiarity-is-not-recall");
  await expect(
    page.getByRole("heading", { name: "أغلق المصدر واستدعِ" }),
  ).toBeVisible();
  await expect(
    page.getByText("القراءة بداية… والاختبار يكشف الفرق", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".model-answer")).toHaveCount(0);
  await page
    .getByLabel("إجابتك قبل الكشف", { exact: true })
    .fill("تحتوي النواة معظم المادة الوراثية.");
  await expect
    .poll(async () => {
      const current = await state(context);
      return current.lessonAttempts[0]?.draftResponse;
    })
    .toBe("تحتوي النواة معظم المادة الوراثية.");
  await page.reload();
  await expect(
    page.getByLabel("إجابتك قبل الكشف", { exact: true }),
  ).toHaveValue("تحتوي النواة معظم المادة الوراثية.");
  expect((await state(context)).lessonAttempts).toHaveLength(1);
  const submitRoute = "**/api/learning";
  await page.route(submitRoute, async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "submit") await route.abort("failed");
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "احفظ إجابتي واكشف المعيار", exact: true })
    .click();
  await expect(page.locator('.error-message[role="alert"]')).toContainText(
    "لا نعرض نتيجة قبل تأكيد الحفظ",
  );
  expect((await state(context)).answers).toHaveLength(0);
  await expect(
    page.getByLabel("إجابتك قبل الكشف", { exact: true }),
  ).toHaveValue("تحتوي النواة معظم المادة الوراثية.");
  await page.unroute(submitRoute);
  await page
    .getByRole("button", { name: "احفظ إجابتي واكشف المعيار", exact: true })
    .click();
  await expect(
    page.getByText("إجابتك حُفظت · قيّمها بنفسك", { exact: true }),
  ).toBeVisible();
  let current = await state(context);
  expect(current.answers).toHaveLength(1);
  expect(current.answers[0].correct).toBeNull();
  await page
    .getByRole("button", { name: "تذكّرت / أنجزت المعيار", exact: true })
    .click();
  await page.getByRole("button", { name: "تابع التجربة", exact: true }).click();
  await page.getByLabel("أعيد قراءتها حتى تبدو سهلة.", { exact: true }).check();
  await page
    .getByRole("button", { name: "احفظ إجابتي وتحقّق", exact: true })
    .click();
  await expect(
    page.getByText("فرصة لتوضيح الفكرة · تقييم آلي محدد", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".feedback-panel")).toContainText("الألفة");
  await page.reload();
  await expect(
    page.getByText("فرصة لتوضيح الفكرة · تقييم آلي محدد", { exact: true }),
  ).toBeVisible();
  current = await state(context);
  expect(current.answers).toHaveLength(2);
  expect(
    current.answers.find((answer: any) => answer.questionId === "recognize")
      .correct,
  ).toBe(false);
  await page.getByRole("button", { name: "تابع التجربة", exact: true }).click();
  await complete(page);
  current = await state(context);
  expect(current.lessonAttempts[0].status).toBe("completed");
  expect(current.reviews).toHaveLength(1);
  expect(new Date(current.reviews[0].dueAt).getTime()).toBeGreaterThan(
    Date.now() + 23 * 60 * 60 * 1000,
  );
  await page
    .getByRole("button", { name: "جرّب الدرس من جديد", exact: true })
    .click();
  current = await state(context);
  expect(current.lessonAttempts).toHaveLength(2);
  expect(current.answers).toHaveLength(2);
  expect(
    current.lessonAttempts.filter(
      (attempt: any) => attempt.status === "completed",
    ),
  ).toHaveLength(1);

  // Technical review-loop verification: deliberately reschedule now. This is not a human 24-hour retention observation.
  await page.goto(`${ORIGIN}/reviews`);
  await page.getByRole("button", { name: /تغيير موعد دون فتح الدرس/ }).click();
  const target = new Date(Date.now() - 120000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hebron",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(target);
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  await page
    .getByLabel("التاريخ والوقت · Asia/Hebron", { exact: true })
    .fill(
      `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`,
    );
  await page.getByRole("button", { name: "احفظ الموعد", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "ابدأ المراجعة", exact: true })
    .click();
  await expect(page.getByText("المعيار للمقارنة", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByLabel("ماذا تتذكر، دون فتح المصدر؟", { exact: true })
    .fill(
      "الألفة شعور بالتعرف، والاستدعاء محاولة الإجابة دون النظر إلى المصدر.",
    );
  await page
    .getByRole("button", { name: "احفظ إجابتي واكشف المعيار", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "المعيار للمقارنة", exact: true }),
  ).toBeVisible();
  current = await state(context);
  expect(
    current.reviewEvents.filter((event: any) => event.kind === "attempt"),
  ).toHaveLength(1);
  await page.reload();
  await page
    .getByRole("button", { name: "ابدأ المراجعة", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "المعيار للمقارنة", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "تذكّرت · فاصل أطول", exact: true })
    .click();
  current = await state(context);
  expect(
    current.reviewEvents.filter((event: any) => event.kind === "reschedule"),
  ).toHaveLength(1);
  expect(
    current.reviewEvents.find((event: any) => event.kind === "attempt").rating,
  ).toBe("good");
  expect(new Date(current.reviews[0].dueAt).getTime()).toBeGreaterThan(
    Date.now() + 2 * 86400000,
  );
  await page.goto(`${ORIGIN}/progress`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test("L2–L4 complete actual exercises, clear self-grading and prediction comparison", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await newAccount(context);
  await startLesson(page, "useful-self-test");
  await submitChoice(page, "ما دور الميتوكوندريا في إمداد الخلية بالطاقة؟");
  await page
    .getByLabel("إجابتك قبل الكشف", { exact: true })
    .fill("ما وظيفة الغشاء الخلوي في تنظيم مرور المواد؟");
  await page
    .getByRole("button", { name: "احفظ إجابتي واكشف المعيار", exact: true })
    .click();
  await expect(page.locator(".feedback-panel")).toContainText(
    "لا تقييم دلاليًا آليًا هنا",
  );
  await page
    .getByRole("button", { name: "تذكّرت / أنجزت المعيار", exact: true })
    .click();
  await page.getByRole("button", { name: "تابع التجربة", exact: true }).click();
  await complete(page);
  await startLesson(page, "spaced-practice");
  await page.getByRole("button", { name: "رفع العنصر 2", exact: true }).click();
  await page.getByRole("button", { name: "رفع العنصر 3", exact: true }).click();
  await page
    .getByRole("button", { name: "احفظ إجابتي وتحقّق", exact: true })
    .click();
  await expect(
    page.getByText("إجابة صحيحة · تقييم آلي محدد", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "تابع التجربة", exact: true }).click();
  await submitChoice(
    page,
    "محاولة اليوم، وأخرى في يوم لاحق، وثالثة بعد فاصل آخر.",
  );
  await complete(page);
  await startLesson(page, "metacognitive-calibration");
  await page.getByRole("button", { name: "٢ من ٢", exact: true }).click();
  await page.getByRole("button", { name: "احفظ توقعي", exact: true }).click();
  await page.getByRole("button", { name: "إلى الاختبار", exact: true }).click();
  await submitChoice(page, "الميتوكوندريا");
  await submitChoice(page, "تنظيم مرور المواد بين الخلية وبيئتها.");
  await expect(
    page.getByRole("heading", { name: "توقع ونتيجة، دون تصنيف", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".calibration-summary")).toContainText(
    "هذه عينة من سؤالين",
  );
  await complete(page);
  const current = await state(context);
  expect(
    current.lessonAttempts.filter(
      (attempt: any) => attempt.status === "completed",
    ),
  ).toHaveLength(3);
  expect(current.reviews).toHaveLength(3);
  const prediction = current.answers.find(
    (answer: any) => answer.questionId === "prediction",
  );
  expect(prediction.correct).toBeNull();
  expect(prediction.gradingSource).toBe("ungraded");
});

test("mobile learning, subject editing and pause/resume timer survive refresh", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await newAccount(context);
  await page.goto(`${ORIGIN}/learn`);
  await expect(
    page.getByRole("heading", { name: "تعلّم كيف تتعلّم." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.goto(`${ORIGIN}/study`);
  await page.getByRole("button", { name: "إضافة مادة", exact: true }).click();
  await page.getByLabel("اسم المادة", { exact: true }).fill("أحياء تجريبية");
  await page
    .getByLabel("فصول / محاضرات / موضوعات · كل واحد في سطر", { exact: true })
    .fill("الخلية\nالوراثة");
  await page.getByRole("button", { name: "احفظ المادة", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByLabel("ماذا ستدرس؟", { exact: true })
    .selectOption("أحياء تجريبية · الخلية");
  await page.getByRole("button", { name: "٢٥ د", exact: true }).click();
  await page
    .getByRole("button", { name: "ابدأ جلسة الدراسة", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "إيقاف مؤقت", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "إيقاف مؤقت", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "متابعة", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "متابعة", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "متابعة", exact: true }).click();
  await page
    .getByLabel("ما الفكرة التي تستطيع اختبارها؟ اختياري", { exact: true })
    .fill("أختبر وظيفة الغشاء.");
  await page.getByRole("button", { name: "إنهاء وحفظ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "جلسات محفوظة", exact: true }),
  ).toBeVisible();
  const current = await state(context);
  expect(current.subjects).toHaveLength(1);
  expect(current.studySessions).toHaveLength(1);
  expect(current.studySessions[0].status).toBe("completed");
  expect(current.studySessions[0].outcome).toBe("أختبر وظيفة الغشاء.");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
