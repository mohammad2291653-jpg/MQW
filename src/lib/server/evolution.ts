/**
 * MQW 90 — server-side validation and invariants.
 *
 * Every record lives in the existing owner-scoped `records` store (no new tables),
 * so ownership, RLS (PostgreSQL), export and account deletion semantics are
 * inherited. Rules here enforce the clinical/privacy boundaries:
 *  - no dose/strength/frequency is ever defaulted; free text is stored as entered;
 *  - microneedling can only be logged as a clinician-established event;
 *  - wellbeing is disabled by default;
 *  - history is preserved (schedule versions, workout snapshots).
 */
import { randomUUID } from "node:crypto";
import {
  ApiError,
  deleteEntity,
  listEntities,
  preferences,
  requireEntity,
  updateEntity,
} from "./db";
import { optionalText, text } from "./http";
import {
  BALANCE_DOMAINS,
  CYCLE_STATES,
  MILESTONE_DAYS,
  PILLARS,
  isDay,
  localDate,
  versionOn,
  weekStart,
  type CycleState,
  type Schedule,
  type ScheduleVersion,
} from "../evolution";
import type { Entity } from "../types";
import {
  EVO_COLLECTIONS,
  EVO_STATE_COLLECTIONS,
} from "./evolution-collections";

export { EVO_COLLECTIONS, EVO_STATE_COLLECTIONS };
type V = Record<string, unknown>;

function oneOf<T extends string>(
  v: unknown,
  allowed: readonly T[],
  label: string,
  d?: T,
): T {
  if (v === undefined && d !== undefined) return d;
  if (typeof v !== "string" || !allowed.includes(v as T))
    throw new ApiError(`${label} غير صالح.`);
  return v as T;
}
function bool(v: unknown, d = false) {
  if (v === undefined || v === null) return d;
  if (typeof v !== "boolean") throw new ApiError("قيمة الاختيار غير صالحة.");
  return v;
}
function num(
  v: unknown,
  min: number,
  max: number,
  label: string,
  opts: { int?: boolean; optional?: boolean } = {},
) {
  if ((v === undefined || v === null || v === "") && opts.optional) return null;
  if (
    typeof v !== "number" ||
    !Number.isFinite(v) ||
    v < min ||
    v > max ||
    (opts.int && !Number.isInteger(v))
  )
    throw new ApiError(`${label}: القيمة خارج النطاق المسموح.`);
  return v;
}
function day(v: unknown, label = "التاريخ") {
  if (!isDay(v)) throw new ApiError(`${label} غير صالح.`);
  return v;
}
function optionalDay(v: unknown, label = "التاريخ") {
  if (v === undefined || v === null || v === "") return null;
  return day(v, label);
}
const CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
function clock(v: unknown, optional = true) {
  if ((v === undefined || v === null || v === "") && optional) return "";
  if (typeof v !== "string" || !CLOCK.test(v))
    throw new ApiError("الوقت غير صالح.");
  return v;
}
function instant(v: unknown, optional = true) {
  if ((v === undefined || v === null || v === "") && optional) return null;
  if (typeof v !== "string" || v.length > 40 || !Number.isFinite(Date.parse(v)))
    throw new ApiError("الطابع الزمني غير صالح.");
  return new Date(v).toISOString();
}
function timezone(v: unknown) {
  if (typeof v !== "string" || v.length > 100)
    throw new ApiError("المنطقة الزمنية غير صالحة.");
  try {
    new Intl.DateTimeFormat("ar", { timeZone: v }).format();
  } catch {
    throw new ApiError("المنطقة الزمنية غير صالحة.");
  }
  return v;
}
function stringList(v: unknown, max: number, len = 200) {
  if (v === undefined || v === null) return [];
  if (
    !Array.isArray(v) ||
    v.length > max ||
    v.some((x) => typeof x !== "string" || !x.trim() || x.length > len)
  )
    throw new ApiError("القائمة غير صالحة.");
  return [...new Set((v as string[]).map((x) => x.trim()))];
}
function url(v: unknown) {
  const value = optionalText(v, 1000).trim();
  if (!value) return "";
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
  } catch {
    throw new ApiError("رابط المنتج غير صالح.");
  }
  return value;
}
/** Verify a referenced record belongs to this owner — only when the reference changes. */
async function ref(
  userId: string,
  collection: string,
  v: unknown,
  old?: V,
  field?: string,
) {
  if (v === undefined || v === null || v === "") return null;
  const id = text(v, "المعرّف", 100);
  if (old && field && old[field] === id) return id;
  await requireEntity(userId, collection, id);
  return id;
}
async function currentCycleId(userId: string) {
  const cycles = await listEntities<Entity & { state: CycleState }>(
    userId,
    "evoCycles",
  );
  return cycles.find((c) => c.state === "active" || c.state === "paused")?.id;
}

function schedule(v: unknown): Schedule {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new ApiError("الجدول غير صالح.");
  const s = v as V;
  const times = stringList(s.times, 6, 5)
    .map((t) => clock(t, false))
    .sort();
  const kind = oneOf(
    s.kind,
    ["daily", "weekdays", "interval", "as_needed"] as const,
    "نوع التكرار",
  );
  if (kind === "weekdays") {
    if (
      !Array.isArray(s.weekdays) ||
      !s.weekdays.length ||
      s.weekdays.length > 7 ||
      s.weekdays.some(
        (d) => !Number.isInteger(d) || (d as number) < 0 || (d as number) > 6,
      )
    )
      throw new ApiError("اختر يومًا واحدًا على الأقل من الأسبوع.");
    return {
      kind,
      weekdays: [...new Set(s.weekdays as number[])].sort(),
      times,
    };
  }
  if (kind === "interval")
    return {
      kind,
      every: num(s.every, 2, 60, "عدد الأيام", { int: true }) as number,
      times,
    };
  return { kind, times };
}
const sameSchedule = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

const TRANSITIONS: Record<CycleState, CycleState[]> = {
  draft: ["draft", "active", "archived"],
  active: ["active", "paused", "completed", "archived"],
  paused: ["paused", "active", "completed", "archived"],
  completed: ["completed", "archived"],
  archived: ["archived"],
};

export async function validateEvolution(
  userId: string,
  collection: string,
  v: V,
  old?: V,
): Promise<V> {
  switch (collection) {
    case "evoCycles": {
      const state = oneOf(v.state, CYCLE_STATES, "حالة الدورة", "draft");
      if (old && !TRANSITIONS[old.state as CycleState].includes(state))
        throw new ApiError(
          "لا يمكن نقل الدورة إلى هذه الحالة. ابدأ دورة جديدة بدلًا من ذلك.",
        );
      if (old && old.state === "archived")
        throw new ApiError("الدورة المؤرشفة محفوظة للقراءة فقط.");
      if (!Array.isArray(v.goals) || v.goals.length > 3)
        throw new ApiError("اختر حتى ثلاثة أهداف رئيسية.");
      const goals = (v.goals as V[]).map((g) => ({
        id:
          typeof g?.id === "string" && g.id.length <= 100 ? g.id : randomUUID(),
        title: text(g?.title, "عنوان الهدف", 300),
        target: optionalText(g?.target, 300),
      }));
      const p = (v.pillars || {}) as V;
      const pillars = Object.fromEntries(
        PILLARS.map((k) => [k, bool(p[k], k === "wellbeing" ? false : true)]),
      );
      const now = new Date().toISOString();
      const prev = old?.state as CycleState | undefined;
      return {
        startDate: day(v.startDate, "تاريخ البداية"),
        timezone: timezone(v.timezone),
        state,
        goals,
        pillars,
        balanceDomains:
          v.balanceDomains === undefined
            ? BALANCE_DOMAINS.slice(0, 3)
            : stringList(v.balanceDomains, 12, 80),
        pausedAt:
          state === "paused" ? (prev === "paused" ? old!.pausedAt : now) : null,
        completedAt:
          state === "completed"
            ? prev === "completed"
              ? old!.completedAt
              : now
            : (old?.completedAt ?? null),
        archivedAt:
          state === "archived"
            ? prev === "archived"
              ? old!.archivedAt
              : now
            : null,
        note: optionalText(v.note, 2000),
      };
    }
    case "evoDaily":
      return {
        cycleId: await ref(userId, "evoCycles", v.cycleId, old, "cycleId"),
        date: day(v.date),
        focus: optionalText(v.focus, 300).trim(),
        status: oneOf(
          v.status,
          [
            "planned",
            "done",
            "rest",
            "skipped",
            "postponed",
            "not_applicable",
          ] as const,
          "الحالة",
          "planned",
        ),
        note: optionalText(v.note, 2000),
      };
    case "evoProducts": {
      const pillar = oneOf(v.pillar, ["skin", "hair"] as const, "القسم");
      const area = oneOf(
        v.area,
        pillar === "skin" ? (["face"] as const) : (["scalp", "beard"] as const),
        "المنطقة",
        pillar === "skin" ? "face" : undefined,
      );
      return {
        pillar,
        area,
        name: text(v.name, "اسم المنتج", 200),
        brand: optionalText(v.brand, 200),
        ingredients: optionalText(v.ingredients, 5000),
        size: optionalText(v.size, 100),
        source: optionalText(v.source, 300),
        url: url(v.url),
        // Stored exactly as the user copied it from the label or a clinician; never defaulted.
        labelInstructions: optionalText(v.labelInstructions, 3000),
        strengthAsLabelled: optionalText(v.strengthAsLabelled, 100),
        clinicianNote: optionalText(v.clinicianNote, 3000),
        patchTestNote: optionalText(v.patchTestNote, 1000),
        status: oneOf(
          v.status,
          ["active", "paused", "discontinued"] as const,
          "الحالة",
          "active",
        ),
      };
    }
    case "evoRoutineEvents": {
      const pillar = oneOf(v.pillar, ["skin", "hair"] as const, "القسم");
      const kind = oneOf(
        v.kind,
        ["application", "microneedling"] as const,
        "نوع السجل",
        "application",
      );
      const clinicianEstablished = bool(v.clinicianEstablished);
      if (
        kind === "microneedling" &&
        (pillar !== "hair" || !clinicianEstablished)
      )
        throw new ApiError(
          "سجل الوخز الدقيق متاح فقط لجلسات وضعها مختص سريري. لا يقدّم التطبيق بروتوكولًا أو عمقًا أو تكرارًا.",
        );
      return {
        cycleId:
          (await ref(userId, "evoCycles", v.cycleId, old, "cycleId")) ??
          (old ? null : await currentCycleId(userId)) ??
          null,
        pillar,
        area: oneOf(
          v.area,
          pillar === "skin"
            ? (["face"] as const)
            : (["scalp", "beard"] as const),
          "المنطقة",
          pillar === "skin" ? "face" : undefined,
        ),
        kind,
        productId: await ref(
          userId,
          "evoProducts",
          v.productId,
          old,
          "productId",
        ),
        date: day(v.date),
        time: clock(v.time),
        status: oneOf(
          v.status,
          ["done", "skipped", "paused", "discontinued"] as const,
          "الحالة",
          "done",
        ),
        clinicianEstablished,
        irritation: bool(v.irritation),
        notes: optionalText(v.notes, 3000),
      };
    }
    case "evoObservations": {
      const pillar = oneOf(v.pillar, ["skin", "hair"] as const, "القسم");
      return {
        cycleId:
          (await ref(userId, "evoCycles", v.cycleId, old, "cycleId")) ??
          (old ? null : await currentCycleId(userId)) ??
          null,
        pillar,
        area: oneOf(
          v.area,
          pillar === "skin"
            ? (["face"] as const)
            : (["scalp", "beard"] as const),
          "المنطقة",
          pillar === "skin" ? "face" : undefined,
        ),
        date: day(v.date),
        productId: await ref(
          userId,
          "evoProducts",
          v.productId,
          old,
          "productId",
        ),
        narrative: text(v.narrative, "الملاحظة", 5000),
        rating: num(v.rating, 1, 5, "التقدير الشخصي", {
          int: true,
          optional: true,
        }),
        irritation: bool(v.irritation),
      };
    }
    case "evoAgencyReviews": {
      const checklist = (v.checklist ?? {}) as V;
      if (
        typeof checklist !== "object" ||
        Array.isArray(checklist) ||
        Object.keys(checklist).length > 30
      )
        throw new ApiError("قائمة التحقق غير صالحة.");
      for (const [k, x] of Object.entries(checklist))
        if (k.length > 80 || typeof x !== "boolean")
          throw new ApiError("قائمة التحقق غير صالحة.");
      return {
        productName: text(v.productName, "اسم المنتج", 200),
        supplier: optionalText(v.supplier, 300),
        manufacturer: optionalText(v.manufacturer, 300),
        documentsRequested: optionalText(v.documentsRequested, 3000),
        claimsToVerify: optionalText(v.claimsToVerify, 3000),
        territory: optionalText(v.territory, 300),
        priceNotes: optionalText(v.priceNotes, 1000),
        checklist,
        decision: oneOf(
          v.decision,
          ["exploring", "on_hold", "declined", "pursuing"] as const,
          "القرار",
          "exploring",
        ),
        notes: optionalText(v.notes, 5000),
      };
    }
    case "evoSupplements": {
      const startDate = day(v.startDate, "تاريخ البدء");
      const endDate = optionalDay(v.endDate, "تاريخ الانتهاء");
      if (endDate && endDate < startDate)
        throw new ApiError("تاريخ الانتهاء يجب أن يكون بعد البدء.");
      const sched = schedule(v.schedule);
      let history: ScheduleVersion[];
      if (!old) history = [{ version: 1, from: startDate, schedule: sched }];
      else {
        history = (old.scheduleHistory as ScheduleVersion[]) || [];
        if (!sameSchedule(history.at(-1)?.schedule, sched)) {
          const tz = (await preferences(userId)).timezone;
          const today = localDate(tz);
          const from =
            isDay(v.effectiveFrom) && v.effectiveFrom >= today
              ? v.effectiveFrom
              : today;
          // Earlier intakes keep their version; the new version applies from today forward.
          history = [
            ...history,
            {
              version: (history.at(-1)?.version || 0) + 1,
              from,
              schedule: sched,
            },
          ];
        }
      }
      return {
        kind: oneOf(
          v.kind,
          ["supplement", "medication"] as const,
          "النوع",
          "supplement",
        ),
        name: text(v.name, "الاسم", 200),
        brand: optionalText(v.brand, 200),
        purpose: optionalText(v.purpose, 1000),
        ingredient: optionalText(v.ingredient, 1000),
        strength: optionalText(v.strength, 100),
        doseText: optionalText(v.doseText, 200),
        sourceNote: optionalText(v.sourceNote, 1000),
        contraindicationNote: optionalText(v.contraindicationNote, 2000),
        professionalAdvice: optionalText(v.professionalAdvice, 3000),
        status: oneOf(
          v.status,
          ["active", "paused", "discontinued"] as const,
          "الحالة",
          "active",
        ),
        startDate,
        endDate,
        schedule: sched,
        scheduleHistory: history,
      };
    }
    case "evoIntakes": {
      const supplementId = (await ref(
        userId,
        "evoSupplements",
        v.supplementId,
        old,
        "supplementId",
      ))!;
      if (!supplementId) throw new ApiError("اختر عنصرًا من قائمتك.");
      const date = day(v.date);
      const sup = await requireEntity<
        Entity & { scheduleHistory: ScheduleVersion[] }
      >(userId, "evoSupplements", supplementId);
      const status = oneOf(
        v.status,
        ["taken", "skipped", "postponed", "not_applicable"] as const,
        "الحالة",
      );
      return {
        supplementId,
        date,
        time: clock(v.time),
        scheduleVersion:
          versionOn(sup.scheduleHistory || [], date)?.version ?? 1,
        status,
        actualAt:
          status === "taken"
            ? (instant(v.actualAt) ?? new Date().toISOString())
            : null,
        note: optionalText(v.note, 1000),
      };
    }
    case "evoExercises":
      return {
        name: text(v.name, "اسم التمرين", 200),
        muscleGroup: optionalText(v.muscleGroup, 100),
        equipment: optionalText(v.equipment, 100),
        notes: optionalText(v.notes, 2000),
        archived: bool(v.archived),
      };
    case "evoTemplates": {
      const ids = stringList(v.exerciseIds, 40, 100);
      const before = new Set((old?.exerciseIds as string[]) || []);
      for (const id of ids)
        if (!before.has(id)) await requireEntity(userId, "evoExercises", id);
      return {
        name: text(v.name, "اسم القالب", 100),
        type: oneOf(
          v.type,
          ["push", "pull", "legs", "custom"] as const,
          "نوع القالب",
        ),
        exerciseIds: ids,
        order: num(v.order ?? 0, 0, 100, "الترتيب", { int: true }),
        notes: optionalText(v.notes, 2000),
      };
    }
    case "evoWorkouts": {
      if (
        !Array.isArray(v.sets ?? []) ||
        ((v.sets as unknown[]) ?? []).length > 300
      )
        throw new ApiError("عدد المجموعات أكبر من المسموح.");
      const ids = new Set<string>();
      const sets = ((v.sets as V[]) ?? []).map((s) => {
        const id = text(s?.id, "معرّف المجموعة", 100);
        if (ids.has(id)) throw new ApiError("مجموعة مكرّرة.");
        ids.add(id);
        return {
          id,
          exerciseId: optionalText(s.exerciseId, 100) || undefined,
          exerciseName: text(s.exerciseName, "اسم التمرين", 200),
          reps: num(s.reps, 0, 1000, "التكرارات", {
            int: true,
            optional: true,
          }),
          load: num(s.load, 0, 2000, "الوزن", { optional: true }),
          unit: oneOf(s.unit, ["kg", "lb"] as const, "الوحدة", "kg"),
          rpe: num(s.rpe, 1, 10, "RPE", { optional: true }),
          rir: num(s.rir, 0, 10, "RIR", { int: true, optional: true }),
          restSeconds: num(s.restSeconds, 0, 3600, "الراحة", {
            int: true,
            optional: true,
          }),
          note: optionalText(s.note, 500),
        };
      });
      const status = oneOf(
        v.status,
        ["in_progress", "completed", "interrupted"] as const,
        "حالة الجلسة",
        "in_progress",
      );
      if (old && old.status === "completed" && status === "in_progress")
        throw new ApiError("الجلسة المكتملة محفوظة؛ ابدأ جلسة جديدة.");
      return {
        cycleId:
          (await ref(userId, "evoCycles", v.cycleId, old, "cycleId")) ??
          (old ? null : await currentCycleId(userId)) ??
          null,
        templateId: await ref(
          userId,
          "evoTemplates",
          v.templateId,
          old,
          "templateId",
        ),
        templateName: text(v.templateName ?? "جلسة حرة", "اسم الجلسة", 100),
        type: oneOf(
          v.type,
          ["push", "pull", "legs", "custom", "free"] as const,
          "نوع الجلسة",
          "free",
        ),
        date: day(v.date),
        startedAt: instant(v.startedAt, false),
        endedAt:
          status === "in_progress"
            ? null
            : (instant(v.endedAt) ?? new Date().toISOString()),
        status,
        sets,
        recovery: num(v.recovery, 1, 5, "الاستشفاء", {
          int: true,
          optional: true,
        }),
        painNote: optionalText(v.painNote, 1000),
        notes: optionalText(v.notes, 3000),
      };
    }
    case "evoRestDays":
      return {
        cycleId:
          (await ref(userId, "evoCycles", v.cycleId, old, "cycleId")) ??
          (old ? null : await currentCycleId(userId)) ??
          null,
        date: day(v.date),
        note: optionalText(v.note, 500),
      };
    case "evoMetrics":
      return {
        type: text(v.type, "نوع القياس", 60),
        value: num(v.value, 0, 100000, "القيمة"),
        unit: text(v.unit, "الوحدة", 20),
        date: day(v.date),
      };
    case "evoWellbeing": {
      const values = {
        date: day(v.date),
        mood: num(v.mood, 1, 5, "المزاج", { int: true, optional: true }),
        stress: num(v.stress, 1, 5, "التوتر", { int: true, optional: true }),
        energy: num(v.energy, 1, 5, "الطاقة", { int: true, optional: true }),
        note: optionalText(v.note, 5000),
      };
      if (
        values.mood === null &&
        values.stress === null &&
        values.energy === null &&
        !values.note.trim()
      )
        throw new ApiError("سجّل قيمة واحدة على الأقل، أو تخطَّ اليوم دون حرج.");
      return values;
    }
    case "evoJournal":
      return {
        date: day(v.date),
        prompt: oneOf(
          v.prompt,
          [
            "free",
            "emotions",
            "boundaries",
            "relationships",
            "gratitude",
          ] as const,
          "نوع التأمل",
          "free",
        ),
        body: text(v.body, "النص", 50000),
      };
    case "evoWeekly": {
      const ws = day(v.weekStart, "بداية الأسبوع");
      if (weekStart(ws) !== ws)
        throw new ApiError("بداية الأسبوع يجب أن تكون يوم سبت.");
      return {
        cycleId: await ref(userId, "evoCycles", v.cycleId, old, "cycleId"),
        weekStart: ws,
        domains: stringList(v.domains, 3, 80),
        win: optionalText(v.win, 2000),
        constraint: optionalText(v.constraint, 2000),
        nextAction: optionalText(v.nextAction, 500),
        balanceRating: num(v.balanceRating, 1, 5, "تقدير الاتزان", {
          int: true,
          optional: true,
        }),
      };
    }
    case "evoMilestones":
      return {
        cycleId: await ref(userId, "evoCycles", v.cycleId, old, "cycleId"),
        day: num(v.day, 1, 90, "يوم المحطة", { int: true }) as number,
        reflection: optionalText(v.reflection, 10000),
      };
    default:
      throw new ApiError("نوع غير صالح.");
  }
}
// Milestone day must be one of the four check-ins.
export function checkMilestoneDay(values: V) {
  if (!MILESTONE_DAYS.includes(values.day as 1))
    throw new ApiError("المحطات المتاحة: اليوم ١ و٣٠ و٦٠ و٩٠.");
}

type Unique = { fields: string[]; message: string; upsert?: boolean };
const UNIQUE: Partial<Record<string, Unique>> = {
  evoDaily: { fields: ["cycleId", "date"], message: "", upsert: true },
  evoIntakes: {
    fields: ["supplementId", "date", "time"],
    message: "",
    upsert: true,
  },
  evoRestDays: { fields: ["date"], message: "هذا اليوم مسجّل للراحة بالفعل." },
  evoWeekly: { fields: ["cycleId", "weekStart"], message: "", upsert: true },
  evoMilestones: { fields: ["cycleId", "day"], message: "", upsert: true },
  evoWellbeing: { fields: ["date"], message: "", upsert: true },
};
/**
 * Duplicate-safe writes: retries or double taps update the existing record
 * for the same natural key instead of creating a second one.
 */
export async function findDuplicate(
  userId: string,
  collection: string,
  values: V,
  excludeId?: string,
) {
  const rule = UNIQUE[collection];
  if (!rule) return undefined;
  const existing = (await listEntities<Entity>(userId, collection)).find(
    (e) =>
      e.id !== excludeId &&
      rule.fields.every((f) => (e[f] ?? null) === (values[f] ?? null)),
  );
  if (existing && !rule.upsert) throw new ApiError(rule.message, 409);
  return existing;
}
export async function beforeEvolutionCreate(
  userId: string,
  collection: string,
  values: V,
) {
  if (collection === "evoMilestones") checkMilestoneDay(values);
  if (
    ["evoDaily", "evoWeekly", "evoMilestones"].includes(collection) &&
    !values.cycleId
  )
    throw new ApiError("ابدأ دورة ٩٠ يومًا أولًا.");
  if (collection === "evoWellbeing" || collection === "evoJournal") {
    const cycles = await listEntities<
      Entity & { state: CycleState; pillars: Record<string, boolean> }
    >(userId, "evoCycles");
    // Sensitive wellbeing tracking stays off until the owner explicitly enables it.
    if (
      !cycles.some(
        (c) =>
          ["active", "paused", "draft"].includes(c.state) &&
          c.pillars?.wellbeing,
      )
    )
      throw new ApiError(
        "قسم الرفاه النفسي غير مفعّل. فعّله من إعدادات رحلتك إذا رغبت.",
        403,
      );
  }
  if (collection === "evoCycles") {
    const open = (
      await listEntities<Entity & { state: CycleState }>(userId, "evoCycles")
    ).filter((c) => ["draft", "active", "paused"].includes(c.state));
    if (open.length)
      throw new ApiError(
        "لديك دورة مفتوحة. أكملها أو أرشفها قبل بدء دورة جديدة.",
        409,
      );
  }
}
export async function beforeEvolutionPatch(
  userId: string,
  collection: string,
  id: string,
  values: V,
) {
  if (collection === "evoMilestones") checkMilestoneDay(values);
  if (
    collection === "evoCycles" &&
    ["draft", "active", "paused"].includes(String(values.state))
  ) {
    const open = (
      await listEntities<Entity & { state: CycleState }>(userId, "evoCycles")
    ).filter(
      (c) => c.id !== id && ["draft", "active", "paused"].includes(c.state),
    );
    if (open.length)
      throw new ApiError("لا يمكن فتح دورتين في الوقت نفسه.", 409);
  }
  await findDuplicate(userId, collection, values, id).then((dup) => {
    if (dup) throw new ApiError("يوجد سجل آخر لنفس اليوم.", 409);
  });
}
/** Cascades for cycle/supplement/exercise deletion; photos are handled by media.ts. */
export async function beforeEvolutionDelete(
  userId: string,
  collection: string,
  id: string,
) {
  if (collection === "evoSupplements")
    for (const i of await listEntities<Entity>(userId, "evoIntakes"))
      if (i.supplementId === id) await deleteEntity(userId, "evoIntakes", i.id);
  if (collection === "evoCycles")
    for (const c of ["evoDaily", "evoWeekly", "evoMilestones"])
      for (const r of await listEntities<Entity>(userId, c))
        if (r.cycleId === id) await deleteEntity(userId, c, r.id);
  if (collection === "evoExercises")
    for (const t of await listEntities<Entity & { exerciseIds: string[] }>(
      userId,
      "evoTemplates",
    ))
      if (t.exerciseIds.includes(id))
        await updateEntity(userId, "evoTemplates", t.id, {
          exerciseIds: t.exerciseIds.filter((x) => x !== id),
        });
}

export const PILLAR_DATA: Record<
  string,
  { collection: string; match?: (e: Entity) => boolean }[]
> = {
  skin: [
    { collection: "evoProducts", match: (e) => e.pillar === "skin" },
    { collection: "evoRoutineEvents", match: (e) => e.pillar === "skin" },
    { collection: "evoObservations", match: (e) => e.pillar === "skin" },
    { collection: "evoPhotos", match: (e) => e.pillar === "skin" },
  ],
  hair: [
    { collection: "evoProducts", match: (e) => e.pillar === "hair" },
    { collection: "evoRoutineEvents", match: (e) => e.pillar === "hair" },
    { collection: "evoObservations", match: (e) => e.pillar === "hair" },
    { collection: "evoPhotos", match: (e) => e.pillar === "hair" },
  ],
  agency: [{ collection: "evoAgencyReviews" }],
  supplements: [{ collection: "evoSupplements" }, { collection: "evoIntakes" }],
  fitness: [
    { collection: "evoExercises" },
    { collection: "evoTemplates" },
    { collection: "evoWorkouts" },
    { collection: "evoRestDays" },
    { collection: "evoMetrics" },
    { collection: "evoPhotos", match: (e) => e.pillar === "fitness" },
  ],
  wellbeing: [{ collection: "evoWellbeing" }, { collection: "evoJournal" }],
  balance: [{ collection: "evoWeekly" }],
};
