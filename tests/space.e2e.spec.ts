import { expect, test } from "@playwright/test";

const baseURL = process.env.MQW_TEST_URL || "http://localhost:3000";
const password = "SpaceTest!2026-Private";

test.describe("مساحتي — deliberate capture and calm progress", () => {
  test("notes remain notes; explicit conversion, rest days, goals and paused timer persist", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseURL}/sign-up`);
    await page
      .getByRole("textbox", { name: "بماذا نُناديك؟" })
      .fill("مراجعة المساحة");
    await page
      .getByRole("textbox", { name: "البريد الإلكتروني" })
      .fill(`space-e2e-${Date.now()}-${testInfo.workerIndex}@example.test`);
    await page.getByRole("textbox", { name: "كلمة المرور" }).fill(password);
    await page.getByRole("button", { name: "أنشئ مساحتك" }).click();
    await page.waitForURL("**/today", { timeout: 20_000 });

    await page.goto(`${baseURL}/space`);
    await page.getByRole("button", { name: "فكرة جديدة" }).click();
    await page
      .getByRole("textbox", { name: "العنوان" })
      .fill("فكرة اختبار خاصة");
    await page
      .getByRole("textbox", { name: "الفكرة", exact: true })
      .fill("تبقى هذه الفكرة ملاحظة، ولا تتحول تلقائيًا إلى مهمة.");
    await page.getByRole("button", { name: "احفظ", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "فتح فكرة اختبار خاصة" }),
    ).toBeVisible();
    let saved = (await (await page.request.get(`${baseURL}/api/state`)).json())
      .data;
    expect(saved.notes).toHaveLength(1);
    expect(saved.tasks).toHaveLength(0);

    await page.getByRole("button", { name: "فتح فكرة اختبار خاصة" }).click();
    await page.getByRole("button", { name: "أنشئ مهمة مرتبطة" }).click();
    await expect(
      page.getByText("أنشأتَ مهمة مرتبطة. بقيت الملاحظة الأصلية محفوظة.").last(),
    ).toBeVisible();
    await page.getByRole("button", { name: "إغلاق", exact: true }).click();
    saved = (await (await page.request.get(`${baseURL}/api/state`)).json())
      .data;
    expect(saved.notes).toHaveLength(1);
    expect(saved.tasks).toHaveLength(1);
    expect(saved.tasks[0].noteId).toBe(saved.notes[0].id);

    await page.goto(`${baseURL}/space/tasks`);
    await expect(
      page.getByRole("button", { name: "فكرة اختبار خاصة", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("checkbox", { name: "إنجاز فكرة اختبار خاصة" })
      .check();
    await page.getByRole("button", { name: "المنجزة", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "إنجاز فكرة اختبار خاصة" }),
    ).toBeChecked();

    // A proposed time is separate from importance and a deadline, and survives reload.
    await page.getByRole("button", { name: "أضف مهمة" }).click();
    await page
      .getByRole("textbox", { name: "المهمة", exact: true })
      .fill("جلسة مرنة بوقت اختياري");
    await page.getByRole("combobox", { name: /الأهمية/ }).selectOption("3");
    await page
      .getByRole("checkbox", { name: "وقت اختياري", exact: true })
      .check();
    await page
      .getByLabel("يوم الوقت الاختياري", { exact: true })
      .fill("2030-11-18");
    await page.getByLabel("من الساعة", { exact: true }).fill("09:15");
    await page.getByLabel("إلى الساعة", { exact: true }).fill("10:30");
    await page.getByRole("button", { name: "احفظ المهمة" }).click();
    await page.getByRole("button", { name: "الحالية", exact: true }).click();
    await expect(page.getByText("وقت مخطّط:", { exact: false })).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: "جلسة مرنة بوقت اختياري", exact: true })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "وقت اختياري", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByLabel("يوم الوقت الاختياري", { exact: true }),
    ).toHaveValue("2030-11-18");
    await expect(page.getByLabel("من الساعة", { exact: true })).toHaveValue(
      "09:15",
    );
    await expect(page.getByLabel("إلى الساعة", { exact: true })).toHaveValue(
      "10:30",
    );
    await expect(page.getByRole("combobox", { name: /الأهمية/ })).toHaveValue(
      "3",
    );
    await expect(page.getByLabel("موعد اختياري", { exact: true })).toHaveValue(
      "",
    );
    await page.getByRole("button", { name: "إلغاء", exact: true }).click();
    saved = (await (await page.request.get(`${baseURL}/api/state`)).json())
      .data;
    const planned = saved.tasks.find(
      (task: { title: string }) => task.title === "جلسة مرنة بوقت اختياري",
    );
    expect(planned.timeBlock).toEqual({
      date: "2030-11-18",
      start: "09:15",
      end: "10:30",
      timezone: "Asia/Hebron",
    });
    expect(planned.importance).toBe(3);

    await page.goto(`${baseURL}/space/habits`);
    await page.getByRole("button", { name: "عادة جديدة" }).click();
    await page.getByRole("textbox", { name: "اسم العادة" }).fill("قراءة هادئة");
    await page.getByRole("button", { name: "احفظ", exact: true }).click();
    await page.getByRole("button", { name: "يوم راحة", exact: true }).click();
    await expect(
      page.getByText("راحة اخترتها. تبقى جزءًا من سجلّك."),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "يوم راحة", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "مسح تسجيل هذا اليوم" }).click();
    await expect(
      page.getByText("بدون تسجيل لهذا اليوم؛ لا نفترض ما حدث."),
    ).toBeVisible();

    await page.goto(`${baseURL}/space/goals`);
    await page.getByRole("button", { name: "هدف جديد" }).click();
    await page
      .getByRole("textbox", { name: "الهدف", exact: true })
      .fill("اختبار هدف حقيقي");
    await page.getByRole("button", { name: "احفظ", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "اختبار هدف حقيقي" }),
    ).toBeVisible();
    const slider = page.getByRole("slider", {
      name: "تقدم هدف اختبار هدف حقيقي",
    });
    await slider.focus();
    await slider.press("End");
    await page.getByRole("button", { name: "احفظ التقدّم" }).click();
    await page.reload();
    await expect(slider).toHaveValue("100");

    await page.goto(`${baseURL}/space/timer`);
    await page.getByRole("button", { name: "ابدأ وقتًا هادئًا" }).click();
    await page.getByRole("button", { name: "توقّف قليلًا" }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "تابع", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("space-timer-desktop.png"),
      fullPage: true,
    });

    // Editing through a generic note URL must never change a journal entry's privacy type.
    await page.goto(`${baseURL}/space/journal`);
    await page.getByRole("button", { name: "فعّل اليوميّات" }).click();
    await page.getByRole("button", { name: "اكتب لنفسك" }).click();
    await page.getByRole("textbox", { name: "العنوان" }).fill("يوميّة اختبار");
    await page
      .getByRole("textbox", { name: "ما الذي تحب كتابته؟" })
      .fill("تأمل خاص يبقى خارج استنتاجات التعلّم.");
    await page.getByRole("button", { name: "احفظ", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "فتح يوميّة اختبار" }),
    ).toBeVisible();
    saved = (await (await page.request.get(`${baseURL}/api/state`)).json())
      .data;
    const journal = saved.notes.find(
      (note: { journal?: boolean }) => note.journal,
    );
    await page.goto(`${baseURL}/space/notes/${journal.id}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("textbox", { name: "الفكرة", exact: true })
      .fill("تأمل خاص بعد التعديل، وما زال يوميّة.");
    await page.getByRole("button", { name: "احفظ", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    saved = (await (await page.request.get(`${baseURL}/api/state`)).json())
      .data;
    expect(
      saved.notes.find((note: { id: string }) => note.id === journal.id)
        .journal,
    ).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    for (const section of ["", "/tasks", "/habits", "/goals", "/timer"]) {
      await page.goto(`${baseURL}/space${section}`);
      await expect(page.locator(".space-page")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto(`${baseURL}/space`);
    await page.screenshot({
      path: testInfo.outputPath("space-notes-mobile-390.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("a failed note save preserves the draft and shows its error inside the dialog", async ({
    page,
  }, testInfo) => {
    await page.goto(`${baseURL}/sign-up`);
    await page
      .getByRole("textbox", { name: "بماذا نُناديك؟" })
      .fill("اختبار الاستعادة");
    await page
      .getByRole("textbox", { name: "البريد الإلكتروني" })
      .fill(
        `space-recovery-${Date.now()}-${testInfo.workerIndex}@example.test`,
      );
    await page.getByRole("textbox", { name: "كلمة المرور" }).fill(password);
    await page.getByRole("button", { name: "أنشئ مساحتك" }).click();
    await page.waitForURL("**/today", { timeout: 20_000 });
    await page.goto(`${baseURL}/space`);
    await page.getByRole("button", { name: "فكرة جديدة" }).click();
    await page
      .getByRole("textbox", { name: "الفكرة", exact: true })
      .fill("يجب ألا تضيع هذه المسودة عند انقطاع الحفظ.");
    await page.route("**/api/records/notes", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "انقطع الاتصال أثناء الحفظ." }),
      }),
    );
    await page.getByRole("button", { name: "احفظ", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "انقطع الاتصال أثناء الحفظ.",
    );
    await expect(
      page.getByRole("textbox", { name: "الفكرة", exact: true }),
    ).toHaveValue("يجب ألا تضيع هذه المسودة عند انقطاع الحفظ.");
    await page.unroute("**/api/records/notes");
    await page.getByRole("button", { name: "احفظ", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(
          new DOMException(
            "Denied in permission regression test",
            "NotAllowedError",
          ),
        );
    });
    await page.getByRole("button", { name: "تسجيل صوتي", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "لم يُسمح بالميكروفون" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "تسجيل صوتي", exact: true }),
    ).toBeEnabled();
  });
});
