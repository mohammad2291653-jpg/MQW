import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "mqw-evo-"));
process.env.MQW_DATA_DIR = dir;
delete process.env.MQW_DATABASE_URL;
process.env.MQW_STORAGE_BACKEND = "sqlite";
const { db, getState, getEntity, transaction, withOwner } =
  require("../src/lib/server/db") as typeof import("../src/lib/server/db");
const { signUp } =
  require("../src/lib/server/auth") as typeof import("../src/lib/server/auth");
const { createRecord, patchRecord, removeRecord } =
  require("../src/lib/server/records") as typeof import("../src/lib/server/records");
const media =
  require("../src/lib/server/media") as typeof import("../src/lib/server/media");
const { PILLAR_DATA } =
  require("../src/lib/server/evolution") as typeof import("../src/lib/server/evolution");
const evo =
  require("../src/lib/evolution") as typeof import("../src/lib/evolution");

// All accounts and values below are synthetic test data.
let a: Awaited<ReturnType<typeof signUp>>;
let b: Awaited<ReturnType<typeof signUp>>;
const A = () => a.user.id;
const B = () => b.user.id;
const create = (user: string, c: string, v: Record<string, unknown>) =>
  withOwner(user, () =>
    transaction(() => createRecord(user, c, v)),
  ) as Promise<any>;
const patch = (
  user: string,
  c: string,
  id: string,
  v: Record<string, unknown>,
) =>
  withOwner(user, () =>
    transaction(() => patchRecord(user, c, id, v)),
  ) as Promise<any>;
const remove = (user: string, c: string, id: string) =>
  withOwner(user, () => transaction(() => removeRecord(user, c, id)));
before(async () => {
  a = await signUp("evo-a@example.test", "synthetic-password-123", "A");
  b = await signUp("evo-b@example.test", "synthetic-password-456", "B");
});
after(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test("90-day cycle maths is inclusive and DST-safe", () => {
  assert.equal(evo.cycleEnd("2026-03-01"), "2026-05-29");
  assert.equal(evo.cycleDay("2026-03-01", "2026-03-01"), 1);
  assert.equal(evo.cycleDay("2026-03-01", "2026-05-29"), 90);
  assert.equal(evo.cycleDay("2026-03-01", "2026-05-30"), 91);
  assert.equal(evo.cycleDay("2026-03-01", "2026-02-28"), 0);
  // Asia/Hebron and Europe/London both change clocks in late March.
  assert.equal(evo.cycleDay("2026-03-20", "2026-04-02"), 14);
  assert.equal(evo.phaseFor(30)?.key, "foundation");
  assert.equal(evo.phaseFor(31)?.key, "adjustment");
  assert.equal(evo.phaseFor(61)?.key, "evaluation");
  assert.equal(evo.phaseFor(91), null);
  assert.equal(evo.addDays("2028-02-28", 1), "2028-02-29");
  // Local date depends on the zone, not the server clock.
  const instant = new Date("2026-06-30T22:30:00Z");
  assert.equal(evo.localDate("Asia/Hebron", instant), "2026-07-01");
  assert.equal(evo.localDate("America/New_York", instant), "2026-06-30");
  assert.equal(evo.weekStart("2026-11-19"), "2026-11-14"); // Thursday → Saturday
  assert.equal(evo.weekStart("2026-11-14"), "2026-11-14");
});

test("recurrence: daily, weekdays, every N days, end date and version history", () => {
  const anchor = "2026-11-01"; // Sunday
  assert.deepEqual(
    evo.upcomingDays({ kind: "interval", every: 3 }, anchor, anchor, 4),
    ["2026-11-01", "2026-11-04", "2026-11-07", "2026-11-10"],
  );
  assert.deepEqual(
    evo.upcomingDays({ kind: "weekdays", weekdays: [1, 3] }, anchor, anchor, 3),
    ["2026-11-02", "2026-11-04", "2026-11-09"],
  );
  assert.equal(evo.occursOn({ kind: "daily" }, anchor, "2026-10-31"), false);
  assert.equal(
    evo.occursOn({ kind: "daily" }, anchor, "2026-11-20", "2026-11-19"),
    false,
  );
  assert.equal(
    evo.occursOn({ kind: "as_needed" }, anchor, "2026-11-02"),
    false,
  );
  const history = [
    {
      version: 1,
      from: anchor,
      schedule: { kind: "daily" as const, times: ["08:00", "20:00"] },
    },
    {
      version: 2,
      from: "2026-11-10",
      schedule: { kind: "interval" as const, every: 2 },
    },
  ];
  assert.deepEqual(evo.plannedSlots(history, anchor, "2026-11-05"), [
    { version: 1, time: "08:00" },
    { version: 1, time: "20:00" },
  ]);
  // Interval stays anchored to the start date: Nov 11 is day 10 (even offset) → planned.
  assert.deepEqual(evo.plannedSlots(history, anchor, "2026-11-11"), [
    { version: 2, time: "" },
  ]);
  assert.deepEqual(evo.plannedSlots(history, anchor, "2026-11-12"), []);
});

test("volume load counts only sets with both reps and weight, with unit conversion", () => {
  const sets = [
    { id: "1", exerciseName: "x", reps: 10, load: 50, unit: "kg" as const },
    { id: "2", exerciseName: "x", reps: 8, load: null, unit: "kg" as const },
    { id: "3", exerciseName: "x", reps: 5, load: 100, unit: "lb" as const },
  ];
  assert.equal(
    evo.volumeLoad(sets, "kg"),
    Math.round((500 + 5 * 45.359237) * 10) / 10,
  );
});

test("cycle lifecycle: one open cycle, wellbeing off by default, archive is read-only", async () => {
  const cycle = await create(A(), "evoCycles", {
    startDate: "2026-11-19",
    timezone: "Asia/Hebron",
    state: "active",
    goals: [{ title: "ثلاث جلسات تمرين أسبوعيًا" }, { title: "سجل البشرة" }],
  });
  assert.equal(cycle.pillars.wellbeing, false);
  assert.equal(cycle.pillars.fitness, true);
  await assert.rejects(
    () =>
      create(A(), "evoCycles", {
        startDate: "2026-12-01",
        timezone: "Asia/Hebron",
        goals: [],
      }),
    /دورة مفتوحة/,
  );
  await assert.rejects(() =>
    create(A(), "evoCycles", {
      startDate: "2026-12-01",
      timezone: "Asia/Hebron",
      state: "draft",
      goals: [1, 2, 3, 4].map((n) => ({ title: `g${n}` })),
    }),
  );
  const paused = await patch(A(), "evoCycles", cycle.id, { state: "paused" });
  assert.ok(paused.pausedAt);
  assert.equal(paused.startDate, "2026-11-19");
  const resumed = await patch(A(), "evoCycles", cycle.id, { state: "active" });
  assert.equal(resumed.pausedAt, null);
  await assert.rejects(
    () => create(A(), "evoWellbeing", { date: "2026-11-19", mood: 3 }),
    /غير مفعّل/,
  );
  await patch(A(), "evoCycles", cycle.id, {
    pillars: { ...resumed.pillars, wellbeing: true },
  });
  const w1 = await create(A(), "evoWellbeing", { date: "2026-11-19", mood: 3 });
  const w2 = await create(A(), "evoWellbeing", {
    date: "2026-11-19",
    mood: 4,
    note: "retry",
  });
  assert.equal(
    w1.id,
    w2.id,
    "same-day check-in updates instead of duplicating",
  );
  await assert.rejects(
    () => create(A(), "evoWellbeing", { date: "2026-11-20" }),
    /قيمة واحدة/,
  );
  // Archive, then nothing can change; a new cycle may start and history remains.
  await patch(A(), "evoCycles", cycle.id, { state: "archived" });
  await assert.rejects(() =>
    patch(A(), "evoCycles", cycle.id, { state: "active" }),
  );
  await assert.rejects(
    () => patch(A(), "evoCycles", cycle.id, { note: "edit" }),
    /للقراءة فقط/,
  );
  const next = await create(A(), "evoCycles", {
    startDate: "2027-03-01",
    timezone: "Asia/Hebron",
    state: "active",
    goals: [],
  });
  const state = await withOwner(A(), () => getState(A()));
  assert.equal(state.evoCycles.length, 2);
  assert.equal(state.evoWellbeing.length, 1);
  assert.ok(next.id);
});

test("no generated doses: microneedling requires clinician plan; products and supplements keep only user text", async () => {
  const product = await create(A(), "evoProducts", {
    pillar: "hair",
    area: "beard",
    name: "منتج تجريبي",
  });
  assert.equal(product.strengthAsLabelled, "");
  assert.equal(product.labelInstructions, "");
  await assert.rejects(
    () =>
      create(A(), "evoRoutineEvents", {
        pillar: "hair",
        area: "scalp",
        kind: "microneedling",
        date: "2026-11-19",
      }),
    /مختص سريري/,
  );
  await assert.rejects(() =>
    create(A(), "evoRoutineEvents", {
      pillar: "skin",
      kind: "microneedling",
      clinicianEstablished: true,
      date: "2026-11-19",
    }),
  );
  const session = await create(A(), "evoRoutineEvents", {
    pillar: "hair",
    area: "scalp",
    kind: "microneedling",
    clinicianEstablished: true,
    date: "2026-11-19",
    irritation: true,
  });
  assert.equal(session.irritation, true);
  await assert.rejects(() =>
    create(A(), "evoProducts", { pillar: "skin", area: "beard", name: "x" }),
  );
  const sup = await create(A(), "evoSupplements", {
    name: "عنصر تجريبي",
    startDate: "2026-11-01",
    schedule: { kind: "weekdays", weekdays: [0, 3], times: ["08:00"] },
  });
  assert.equal(sup.doseText, "");
  assert.equal(sup.strength, "");
  assert.equal(sup.scheduleHistory.length, 1);
});

test("supplement intakes are idempotent and schedule edits keep history", async () => {
  const sup = await create(A(), "evoSupplements", {
    name: "عنصر ٢",
    startDate: "2026-11-01",
    schedule: { kind: "daily", times: ["09:00"] },
  });
  const i1 = await create(A(), "evoIntakes", {
    supplementId: sup.id,
    date: "2026-11-02",
    time: "09:00",
    status: "taken",
  });
  const i2 = await create(A(), "evoIntakes", {
    supplementId: sup.id,
    date: "2026-11-02",
    time: "09:00",
    status: "taken",
  });
  assert.equal(i1.id, i2.id);
  assert.equal(i1.scheduleVersion, 1);
  const edited = await patch(A(), "evoSupplements", sup.id, {
    schedule: { kind: "interval", every: 2 },
  });
  assert.equal(edited.scheduleHistory.length, 2);
  assert.equal(edited.scheduleHistory[0].schedule.kind, "daily");
  // The earlier intake still references version 1.
  const old = await withOwner(A(), () =>
    getEntity<any>(A(), "evoIntakes", i1.id),
  );
  assert.equal(old.scheduleVersion, 1);
  const unchanged = await patch(A(), "evoSupplements", sup.id, {
    purpose: "ملاحظة",
  });
  assert.equal(
    unchanged.scheduleHistory.length,
    2,
    "non-schedule edits do not add versions",
  );
  await remove(A(), "evoSupplements", sup.id);
  assert.equal(
    await withOwner(A(), () => getEntity(A(), "evoIntakes", i1.id)),
    undefined,
  );
});

test("PPL: workouts snapshot names, validate sets and stay completed", async () => {
  const ex = await create(A(), "evoExercises", {
    name: "ضغط صدر",
    muscleGroup: "الصدر",
  });
  const tpl = await create(A(), "evoTemplates", {
    name: "Push",
    type: "push",
    exerciseIds: [ex.id],
  });
  const w = await create(A(), "evoWorkouts", {
    templateId: tpl.id,
    templateName: "Push",
    type: "push",
    date: "2026-11-19",
    startedAt: new Date().toISOString(),
    sets: [
      {
        id: "s1",
        exerciseId: ex.id,
        exerciseName: "ضغط صدر",
        reps: 8,
        load: 40,
        unit: "kg",
        rpe: 8,
      },
    ],
  });
  await assert.rejects(() =>
    patch(A(), "evoWorkouts", w.id, {
      sets: [{ id: "s1", exerciseName: "x", reps: -1 }],
    }),
  );
  await assert.rejects(() =>
    patch(A(), "evoWorkouts", w.id, {
      sets: [
        { id: "d", exerciseName: "x" },
        { id: "d", exerciseName: "y" },
      ],
    }),
  );
  await patch(A(), "evoWorkouts", w.id, { status: "interrupted" });
  const done = await patch(A(), "evoWorkouts", w.id, { status: "completed" });
  assert.ok(done.endedAt);
  await assert.rejects(() =>
    patch(A(), "evoWorkouts", w.id, { status: "in_progress" }),
  );
  // Renaming/deleting the exercise does not rewrite history.
  await remove(A(), "evoExercises", ex.id);
  const after = await withOwner(A(), () =>
    getEntity<any>(A(), "evoWorkouts", w.id),
  );
  assert.equal(after.sets[0].exerciseName, "ضغط صدر");
  const tplAfter = await withOwner(A(), () =>
    getEntity<any>(A(), "evoTemplates", tpl.id),
  );
  assert.deepEqual(tplAfter.exerciseIds, []);
  await create(A(), "evoRestDays", { date: "2026-11-20" });
  await assert.rejects(
    () => create(A(), "evoRestDays", { date: "2026-11-20" }),
    /للراحة/,
  );
});

test("owner isolation across every MQW 90 collection, including nested references", async () => {
  const product = await create(A(), "evoProducts", {
    pillar: "skin",
    name: "سري",
  });
  const sup = await create(A(), "evoSupplements", {
    name: "سري",
    startDate: "2026-11-01",
    schedule: { kind: "daily" },
  });
  const ex = await create(A(), "evoExercises", { name: "سري" });
  const review = await create(A(), "evoAgencyReviews", { productName: "سري" });
  for (const [c, id] of [
    ["evoProducts", product.id],
    ["evoSupplements", sup.id],
    ["evoExercises", ex.id],
    ["evoAgencyReviews", review.id],
  ]) {
    assert.equal(await withOwner(B(), () => getEntity(B(), c, id)), undefined);
    await assert.rejects(() => patch(B(), c, id, { name: "intrusion" }));
    await assert.rejects(() => remove(B(), c, id));
  }
  // B cannot attach its records to A's objects.
  await assert.rejects(() =>
    create(B(), "evoIntakes", {
      supplementId: sup.id,
      date: "2026-11-02",
      status: "taken",
    }),
  );
  await assert.rejects(() =>
    create(B(), "evoObservations", {
      pillar: "skin",
      productId: product.id,
      date: "2026-11-02",
      narrative: "x",
    }),
  );
  await assert.rejects(() =>
    create(B(), "evoTemplates", {
      name: "x",
      type: "push",
      exerciseIds: [ex.id],
    }),
  );
  const stateB = await withOwner(B(), () => getState(B()));
  assert.equal(
    stateB.evoProducts.length +
      stateB.evoSupplements.length +
      stateB.evoAgencyReviews.length,
    0,
  );
});

// Minimal valid JPEG with an APP1/EXIF segment carrying a synthetic GPS marker string.
function jpegWithExif() {
  const exif = Buffer.from("Exif\0\0GPS-SYNTHETIC-31.5,35.1", "latin1");
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1]),
    Buffer.from([(exif.length + 2) >> 8, (exif.length + 2) & 255]),
    exif,
  ]);
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);
  const sos = Buffer.from([
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34,
    0xff, 0xd9,
  ]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, app1, sos]);
}

test("private photos: sniffed type, EXIF stripped, owner-only read, deletion removes the file", async () => {
  await assert.rejects(
    () =>
      media.savePhoto(A(), Buffer.from("<svg onload=alert(1)>"), {
        pillar: "skin",
        area: "face",
        date: "2026-11-19",
        caption: "",
      }),
    /صيغة/,
  );
  const photo = await media.savePhoto(A(), jpegWithExif(), {
    pillar: "hair",
    area: "beard",
    date: "2026-11-19",
    caption: "خط أساس",
  });
  const { bytes } = await media.readPhoto(A(), photo.id);
  assert.equal(
    bytes.includes(Buffer.from("GPS-SYNTHETIC")),
    false,
    "EXIF metadata removed",
  );
  assert.equal(bytes[0], 0xff);
  await assert.rejects(() => media.readPhoto(B(), photo.id), /غير موجود/);
  await assert.rejects(() => media.removePhoto(B(), photo.id));
  // The generic records API cannot write photo metadata.
  await assert.rejects(
    () => create(A(), "evoPhotos", { pillar: "skin" }),
    /غير متاح/,
  );
  const path = media.photoPath(A(), photo.id);
  assert.equal(existsSync(path), true);
  await media.removePhoto(A(), photo.id);
  assert.equal(existsSync(path), false);
});

test("per-pillar deletion erases only that pillar, including photo files", async () => {
  const photo = await media.savePhoto(A(), jpegWithExif(), {
    pillar: "skin",
    area: "face",
    date: "2026-11-19",
    caption: "",
  });
  const hairPhoto = await media.savePhoto(A(), jpegWithExif(), {
    pillar: "hair",
    area: "scalp",
    date: "2026-11-19",
    caption: "",
  });
  await create(A(), "evoObservations", {
    pillar: "skin",
    date: "2026-11-19",
    narrative: "ملاحظة اصطناعية",
  });
  const before = await withOwner(A(), () => getState(A()));
  const hairCount = before.evoProducts.filter(
    (p) => p.pillar === "hair",
  ).length;
  await media.deletePillarData(A(), PILLAR_DATA.skin);
  const state = await withOwner(A(), () => getState(A()));
  assert.equal(
    state.evoObservations.filter((o) => o.pillar === "skin").length,
    0,
  );
  assert.equal(state.evoProducts.filter((p) => p.pillar === "skin").length, 0);
  assert.equal(
    state.evoProducts.filter((p) => p.pillar === "hair").length,
    hairCount,
  );
  assert.equal(existsSync(media.photoPath(A(), photo.id)), false);
  assert.equal(existsSync(media.photoPath(A(), hairPhoto.id)), true);
  assert.ok(
    state.evoAgencyReviews.length >= 1,
    "commercial evaluation is a separate pillar",
  );
});
