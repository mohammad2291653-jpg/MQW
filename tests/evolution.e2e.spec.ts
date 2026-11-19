import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { deflateSync } from "node:zlib";

// Synthetic, clearly fake test data only. No real person, photo or health record.
function syntheticPng(shade: number) {
  const width = 24,
    height = 32;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++)
      raw.set([shade, 120, 200], y * (width * 3 + 1) + 1 + x * 3);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("MQW 90: onboarding, compass, supplements, PPL, skin photos, wellbeing opt-in, weekly review, report", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(240000);
  const origin = baseURL || "http://localhost:3000";
  const password = "Evolution-Synthetic-2026";
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const signup = await context.request.post("/api/auth", {
    headers: { Origin: origin },
    data: {
      action: "sign-up",
      email: `evo-${Date.now()}@mqw.test`,
      password,
      name: "حساب تجريبي",
    },
  });
  expect(signup.ok()).toBeTruthy();
  await context.request.patch("/api/preferences", {
    headers: { Origin: origin },
    data: { onboardingDone: true },
  });
  try {
    // Entry point from Today; still five primary destinations.
    await page.goto("/today");
    await expect(
      page.getByRole("heading", { name: "رحلتي في ٩٠ يومًا" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "التنقل الرئيسي" })
        .getByRole("link"),
    ).toHaveCount(5);
    await page.getByRole("link", { name: /ابدأ رحلتك/ }).click();
    await expect(page).toHaveURL(/\/evolution\/onboarding/);

    // Onboarding: goals required, wellbeing off by default.
    await expect(
      page.getByRole("checkbox", { name: /الرفاه النفسي/ }),
    ).not.toBeChecked();
    await page.getByRole("button", { name: "ابدأ الرحلة" }).click();
    await expect(page.locator(".evo-error")).toContainText("هدفًا واحدًا");
    await page
      .getByRole("button", { name: /ثلاث جلسات تمرين أسبوعيًا/ })
      .click();
    await page
      .getByRole("button", { name: /مراجعة أسبوعية من خمس دقائق/ })
      .click();
    await page.getByRole("button", { name: "ابدأ الرحلة" }).click();
    await expect(page).toHaveURL(/\/evolution$/);
    await expect(page.getByText("اليوم ١ من ٩٠")).toBeVisible();
    await expect(page.locator(".evo-phases li.current")).toContainText(
      "التأسيس",
    );

    // Daily compass with honest statuses; persists after reload.
    await page
      .getByLabel("ما الخطوة المفيدة الواحدة اليوم؟")
      .fill("جلسة Push قصيرة");
    await page.getByRole("button", { name: "اختر خطوتي" }).click();
    await page.getByRole("button", { name: "يوم راحة" }).click();
    await page.reload();
    await expect(page.locator(".evo-compass-status")).toContainText(
      "جلسة Push قصيرة",
    );
    await expect(
      page.getByRole("button", { name: "يوم راحة" }),
    ).toHaveAttribute("aria-pressed", "true");

    // Supplements: no default dose, schedule preview, idempotent intake.
    await page.goto("/evolution/supplements");
    await page.getByRole("button", { name: "أضف عنصرًا" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("الاسم").fill("عنصر اختبار اصطناعي");
    await expect(
      dialog.getByLabel("الكمية التي حددتها أنت أو مختصك"),
    ).toHaveValue("");
    await dialog.getByLabel("نوع التكرار").selectOption("interval");
    await dialog.getByLabel("كل كم يوم؟").fill("3");
    await expect(dialog.getByText(/المواعيد القادمة/)).toBeVisible();
    await dialog.getByRole("button", { name: "أضف", exact: true }).click();
    await expect(dialog).toBeHidden();
    const taken = page
      .getByRole("group", { name: "حالة عنصر اختبار اصطناعي" })
      .getByRole("button", { name: "أخذته" });
    await taken.click();
    await expect(taken).toHaveAttribute("aria-pressed", "true");
    await taken.click();
    await page.reload();
    await expect(page.locator(".evo-facts")).toContainText("١ من ١ موعدًا");
    const state = await (await context.request.get("/api/state")).json();
    expect(state.data.evoIntakes).toHaveLength(1);

    // PPL: starter templates, set logging, interrupt/resume, finish.
    await page.goto("/evolution/fitness");
    await expect(page.getByText("لا جلسات مكتملة بعد")).toBeVisible();
    await page.getByRole("button", { name: "أنشئ قوالب PPL" }).click();
    await expect(page.getByRole("button", { name: /ابدأ Push/ })).toBeVisible();
    await page.getByRole("button", { name: /ابدأ Push/ }).click();
    await expect(page).toHaveURL(/\/evolution\/fitness\/session\//);
    const bench = page
      .locator(".evo-exercise")
      .filter({ hasText: "ضغط صدر بالبار" });
    await bench.getByLabel("تكرارات").fill("8");
    await bench.getByLabel("الوزن").fill("40");
    await bench.getByRole("button", { name: /احفظ مجموعة/ }).click();
    await expect(bench.locator(".evo-sets li")).toHaveCount(1);
    await page.getByRole("button", { name: "أوقفها مؤقتًا" }).click();
    await page.reload();
    await expect(page.locator(".evo-sets li")).toHaveCount(1);
    await page.getByRole("button", { name: "تابع الجلسة" }).click();
    await page.getByRole("button", { name: "أنهِ الجلسة" }).click();
    await expect(page.locator(".evo-badge")).toContainText("مكتملة");
    await page.goto("/evolution/fitness");
    await expect(page.getByText(/يظهر الاتجاه بعد/).first()).toBeVisible();

    // Skin: product, observation with irritation → care message; private photos and manual compare.
    await page.goto("/evolution/skin");
    await page.getByRole("button", { name: "منتج" }).click();
    await page
      .getByRole("dialog")
      .getByLabel("اسم المنتج")
      .fill("منتج وجه تجريبي");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "أضف المنتج" })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
      page.locator(".evo-list").getByText("منتج وجه تجريبي"),
    ).toBeVisible();
    await page.getByLabel("ماذا لاحظت؟").fill("احمرار خفيف اصطناعي للاختبار");
    await page.getByLabel("تهيّج أو أثر جانبي محتمل").check();
    await page.getByRole("button", { name: "احفظ الملاحظة" }).click();
    await expect(page.getByText("سجّلت تهيّجًا محتملًا")).toBeVisible();
    const upload = page.locator(".evo-photos input[type=file]");
    await upload.setInputFiles({
      name: "IMG_private_name.png",
      mimeType: "image/png",
      buffer: syntheticPng(20),
    });
    await expect(page.locator(".evo-photo-grid li")).toHaveCount(1);
    await upload.setInputFiles({
      name: "x.png",
      mimeType: "image/png",
      buffer: syntheticPng(200),
    });
    await expect(page.locator(".evo-photo-grid li")).toHaveCount(2);
    const photos = (await (await context.request.get("/api/state")).json()).data
      .evoPhotos;
    const image = await context.request.get(
      `/api/evolution/photos/${photos[0].id}`,
    );
    expect(image.headers()["cache-control"]).toContain("no-store");
    expect(image.headers()["content-type"]).toBe("image/jpeg");
    await page.locator(".evo-photo-thumb").nth(0).click();
    await page.locator(".evo-photo-thumb").nth(1).click();
    await expect(
      page.getByRole("region", { name: "مقارنة صورتين" }),
    ).toBeVisible();
    await expect(page.getByText(/لا تُعدّ دليلًا سريريًا/)).toBeVisible();
    // Commercial evaluation is a separate route without photos.
    await page.getByRole("link", { name: /التقييم التجاري المنفصل/ }).click();
    await expect(page.getByText("منفصل تمامًا عن بياناتك الصحية")).toBeVisible();
    await expect(page.locator(".evo-photos")).toHaveCount(0);

    // Hair: microneedling requires clinician confirmation; scalp and beard separate.
    await page.goto("/evolution/hair");
    await expect(page.getByText("لا يُنشئ التطبيق أي بروتوكول")).toBeVisible();
    await page.getByRole("button", { name: "سجّل الجلسة" }).click();
    await expect(page.locator(".evo-error")).toContainText("مختص سريري");
    await page.getByRole("radio", { name: "اللحية" }).click();
    await expect(page.locator(".evo-photo-grid li")).toHaveCount(0);

    // Wellbeing: hidden from navigation and off until explicit opt-in.
    await page.goto("/evolution");
    await expect(
      page
        .getByRole("navigation", { name: "أقسام رحلة ٩٠ يومًا" })
        .getByRole("link", { name: "الرفاه" }),
    ).toHaveCount(0);
    await page.goto("/evolution/wellbeing");
    await page.getByRole("button", { name: "فعّل القسم لنفسي" }).click();
    await page.getByRole("button", { name: "المزاج: 3 من ٥" }).click();
    await page
      .getByRole("button", { name: "احفظ", exact: true })
      .first()
      .click();
    await page.getByLabel(/اكتب ما تريد/).fill("يومية اختبار اصطناعية");
    await page
      .locator("form")
      .filter({ hasText: "كتابة حرة" })
      .getByRole("button", { name: "احفظ", exact: true })
      .click();
    await expect(page.locator(".evo-masked")).toHaveCount(1);
    await expect(page.getByText("يومية اختبار اصطناعية")).toHaveCount(0);

    // Weekly review and factual report.
    await page.goto("/evolution/weekly");
    await page
      .getByRole("button", { name: /التمرين/ })
      .first()
      .click();
    await page
      .getByLabel("٣. تعديل واحد صغير للأسبوع القادم")
      .fill("نقل جلسة Legs إلى الأحد");
    await page.getByRole("button", { name: "احفظ المراجعة" }).click();
    await page.goto("/evolution/report");
    await expect(page.getByText("١ جلسة مكتملة")).toBeVisible();
    await expect(page.getByText(/أُخذ ١ من/)).toBeVisible();
    await expect(
      page.getByText("خاص: لا تلخيص للمزاج في التقرير."),
    ).toBeVisible();
    await expect(page.getByText("١ مراجعة أسبوعية")).toBeVisible();

    // Pause keeps day numbering; resume.
    await page.goto("/evolution/settings");
    await page.getByRole("button", { name: "إيقاف مؤقت" }).click();
    await expect(page.locator(".evo-hero-status")).toContainText(
      "متوقفة مؤقتًا",
    );
    await expect(page.locator(".evo-hero-status")).toContainText(
      "اليوم ١ من ٩٠",
    );
    await page.getByRole("button", { name: "استئناف" }).click();

    // Accessibility (automated) on MQW 90 screens at desktop width.
    for (const route of [
      "/evolution",
      "/evolution/supplements",
      "/evolution/fitness",
      "/evolution/skin",
      "/evolution/wellbeing",
      "/evolution/weekly",
      "/evolution/report",
      "/evolution/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        result.violations,
        `${route}: ${result.violations.map((v) => v.id).join(", ")}`,
      ).toEqual([]);
    }
    // Narrow iPhone width: no horizontal overflow on any MQW 90 route.
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of [
      "/today",
      "/space",
      "/evolution",
      "/evolution/skin",
      "/evolution/hair",
      "/evolution/supplements",
      "/evolution/fitness",
      "/evolution/wellbeing",
      "/evolution/weekly",
      "/evolution/report",
      "/evolution/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1").first()).toBeVisible();
      await noOverflow(page);
    }
    // Per-pillar deletion needs the password and removes the photos.
    await page.goto("/evolution/settings");
    await page
      .locator(".evo-chip.danger")
      .filter({ hasText: "البشرة" })
      .click();
    await page.getByRole("dialog").getByLabel("كلمة المرور").fill(password);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "احذف نهائيًا" })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    const after = (await (await context.request.get("/api/state")).json()).data;
    expect(after.evoPhotos).toHaveLength(0);
    expect(
      (
        await context.request.get(`/api/evolution/photos/${photos[0].id}`)
      ).status(),
    ).toBe(404);
    expect(errors).toEqual([]);
  } finally {
    await context.request.delete("/api/account", {
      headers: { Origin: origin },
      data: { password },
    });
  }
});

test("MQW 90 photos are not readable by another account or anonymously", async ({
  browser,
  baseURL,
}) => {
  const origin = baseURL || "http://localhost:3000";
  const a = await browser.newContext();
  const b = await browser.newContext();
  const anon = await browser.newContext();
  const pw = "Isolation-Synthetic-2026";
  try {
    for (const [ctx, who] of [
      [a, "a"],
      [b, "b"],
    ] as const)
      expect(
        (
          await ctx.request.post("/api/auth", {
            headers: { Origin: origin },
            data: {
              action: "sign-up",
              email: `iso-${who}-${Date.now()}@mqw.test`,
              password: pw,
              name: who,
            },
          })
        ).ok(),
      ).toBeTruthy();
    const upload = await a.request.post("/api/evolution/photos", {
      headers: { Origin: origin },
      multipart: {
        file: {
          name: "p.png",
          mimeType: "image/png",
          buffer: syntheticPng(90),
        },
        pillar: "hair",
        area: "scalp",
        date: "2026-11-19",
        caption: "",
      },
    });
    expect(upload.status()).toBe(201);
    const { data: photo } = await upload.json();
    expect(
      (await a.request.get(`/api/evolution/photos/${photo.id}`)).status(),
    ).toBe(200);
    expect(
      (await b.request.get(`/api/evolution/photos/${photo.id}`)).status(),
    ).toBe(404);
    expect(
      (await anon.request.get(`/api/evolution/photos/${photo.id}`)).status(),
    ).toBe(401);
    expect(
      (
        await b.request.delete(`/api/evolution/photos/${photo.id}`, {
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(404);
    // Cross-origin upload is refused.
    expect(
      (
        await a.request.post("/api/evolution/photos", {
          headers: { Origin: "https://evil.example" },
          multipart: {
            file: {
              name: "p.png",
              mimeType: "image/png",
              buffer: syntheticPng(1),
            },
            pillar: "skin",
            date: "2026-11-19",
          },
        })
      ).status(),
    ).toBe(403);
  } finally {
    for (const ctx of [a, b])
      await ctx.request.delete("/api/account", {
        headers: { Origin: origin },
        data: { password: pw },
      });
    await Promise.all([a.close(), b.close(), anon.close()]);
  }
});
