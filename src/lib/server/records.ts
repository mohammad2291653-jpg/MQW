import {
  ApiError,
  createEntity,
  deleteEntity,
  getEntity,
  listEntities,
  requireEntity,
  updateEntity,
  preferences,
  savePreferences,
} from "./db";
import { optionalText, text } from "./http";
const ALLOWED = [
  "notes",
  "tasks",
  "habits",
  "goals",
  "projects",
  "subjects",
  "studySessions",
  "weeklyReviews",
  "insightFeedback",
];
export function checkCollection(collection: string) {
  if (!ALLOWED.includes(collection))
    throw new ApiError("هذا النوع من السجلات غير متاح للتعديل المباشر.", 404);
}
function bool(v: unknown, d = false) {
  if (v === undefined) return d;
  if (typeof v !== "boolean") throw new ApiError("قيمة الاختيار غير صالحة.");
  return v;
}
function num(v: unknown, min: number, max: number, d: number) {
  if (v === undefined) return d;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw new ApiError("القيمة الرقمية خارج النطاق المسموح.");
  return v;
}
function validDay(v: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v + "T00:00:00Z")) &&
    new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v
  );
}
function timeBlock(v: unknown) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "object" || Array.isArray(v))
    throw new ApiError("الوقت الاختياري غير صالح.");
  const { date, start, end, timezone } = v as Record<string, unknown>;
  if (typeof date !== "string" || !validDay(date))
    throw new ApiError("اختر تاريخًا صحيحًا للوقت الاختياري.");
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (
    typeof start !== "string" ||
    typeof end !== "string" ||
    !clock.test(start) ||
    !clock.test(end) ||
    start >= end
  )
    throw new ApiError("يجب أن تكون النهاية بعد البداية في اليوم نفسه.");
  if (
    typeof timezone !== "string" ||
    timezone.length > 100 ||
    (!timezone.includes("/") && !["UTC", "GMT"].includes(timezone))
  )
    throw new ApiError("اختر منطقة زمنية من نوع IANA للوقت الاختياري.");
  try {
    new Intl.DateTimeFormat("ar", { timeZone: timezone }).format();
  } catch {
    throw new ApiError("المنطقة الزمنية للوقت الاختياري غير صالحة.");
  }
  // A plan is local wall-time, not an event instant or an automatic deadline.
  return { date, start, end, timezone };
}
function date(v: unknown, required = false) {
  if (!v && !required) return undefined;
  if (
    typeof v !== "string" ||
    !Number.isFinite(Date.parse(v)) ||
    (/^\d{4}-\d{2}-\d{2}$/.test(v) && !validDay(v))
  )
    throw new ApiError("التاريخ غير صالح.");
  return v;
}
function strings(v: unknown) {
  if (v === undefined) return [];
  if (
    !Array.isArray(v) ||
    v.length > 300 ||
    v.some((x) => typeof x !== "string" || x.length > 300)
  )
    throw new ApiError("القائمة غير صالحة.");
  return v;
}
async function ref(userId: string, collection: string, id: unknown) {
  if (id === undefined || id === null || id === "") return undefined;
  const value = text(id, "المعرّف", 100);
  await requireEntity(userId, collection, value);
  return value;
}
export async function validateRecord(
  userId: string,
  collection: string,
  v: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  checkCollection(collection);
  switch (collection) {
    case "notes":
      return {
        title: optionalText(v.title, 300),
        text: optionalText(v.text, 100000),
        journal: bool(v.journal),
        archived: bool(v.archived),
      };
    case "tasks":
      return {
        title: text(v.title, "عنوان المهمة", 500),
        importance: num(v.importance, 1, 5, 3),
        done: bool(v.done),
        priority: bool(v.priority),
        dueDate: date(v.dueDate),
        projectId: await ref(userId, "projects", v.projectId),
        noteId: await ref(userId, "notes", v.noteId),
        timeBlock: timeBlock(v.timeBlock),
      };
    case "habits": {
      const logs = v.logs ?? {};
      if (
        typeof logs !== "object" ||
        !logs ||
        Array.isArray(logs) ||
        Object.keys(logs).length > 4000
      )
        throw new ApiError("سجل العادة غير صالح.");
      for (const [day, status] of Object.entries(logs)) {
        if (
          !validDay(day) ||
          !["done", "rest", "skipped"].includes(String(status))
        )
          throw new ApiError("حالة العادة أو يومها غير صالح.");
      }
      return { title: text(v.title, "اسم العادة", 300), logs };
    }
    case "goals":
      return {
        title: text(v.title, "عنوان الهدف", 500),
        target: optionalText(v.target, 500),
        progress: num(v.progress, 0, 100, 0),
      };
    case "projects": {
      const stages = strings(v.stages);
      return {
        title: text(v.title, "عنوان المشروع", 500),
        stages,
        stage: num(v.stage, 0, Math.max(stages.length - 1, 0), 0),
      };
    }
    case "subjects":
      return {
        title: text(v.title, "اسم المادة", 300),
        topics: strings(v.topics),
      };
    case "studySessions": {
      const status = v.status ?? "running";
      if (!["running", "paused", "completed"].includes(String(status)))
        throw new ApiError("حالة الجلسة غير صالحة.");
      return {
        subject: optionalText(v.subject, 300),
        minutes: num(v.minutes, 1, 1440, 60),
        status,
        startedAt: date(v.startedAt ?? new Date().toISOString(), true),
        elapsedSeconds: num(v.elapsedSeconds, 0, 86400 * 7, 0),
        resumedAt: date(v.resumedAt),
        outcome: optionalText(v.outcome, 5000),
      };
    }
    case "weeklyReviews":
      return {
        win: optionalText(v.win, 10000),
        obstacle: optionalText(v.obstacle, 10000),
        experiment: optionalText(v.experiment, 10000),
      };
    case "insightFeedback": {
      if (!["dismiss", "inaccurate"].includes(String(v.action)))
        throw new ApiError("ردّ الملاحظة غير صالح.");
      return { ruleId: text(v.ruleId, "الملاحظة", 200), action: v.action };
    }
    default:
      throw new ApiError("نوع غير صالح.");
  }
}
export async function createRecord(
  userId: string,
  collection: string,
  body: Record<string, unknown>,
) {
  const values = await validateRecord(userId, collection, body);
  if (
    collection === "tasks" &&
    values.priority &&
    (await listEntities(userId, "tasks")).filter((t) => t.priority && !t.done)
      .length >= 3
  )
    throw new ApiError("اختر ثلاث أولويات كحد أقصى.");
  return createEntity(userId, collection, values);
}
export async function patchRecord(
  userId: string,
  collection: string,
  id: string,
  body: Record<string, unknown>,
) {
  checkCollection(collection);
  const old = await requireEntity(userId, collection, id);
  const values = await validateRecord(userId, collection, { ...old, ...body });
  if (
    collection === "tasks" &&
    values.priority &&
    !values.done &&
    (await listEntities(userId, "tasks")).filter(
      (t) => t.id !== id && t.priority && !t.done,
    ).length >= 3
  )
    throw new ApiError("اختر ثلاث أولويات كحد أقصى.");
  return updateEntity(userId, collection, id, values);
}
export async function removeRecord(
  userId: string,
  collection: string,
  id: string,
) {
  checkCollection(collection);
  if (collection === "projects")
    for (const task of await listEntities(userId, "tasks"))
      if (task.projectId === id)
        await updateEntity(userId, "tasks", task.id, { projectId: null });
  if (collection === "notes")
    for (const task of await listEntities(userId, "tasks"))
      if (task.noteId === id)
        await updateEntity(userId, "tasks", task.id, { noteId: null });
  await deleteEntity(userId, collection, id);
  return { deleted: true };
}
export async function patchPreferences(
  userId: string,
  body: Record<string, unknown>,
) {
  const value = await preferences(userId);
  for (const [key, v] of Object.entries(body)) {
    if (key === "timezone") {
      if (typeof v !== "string")
        throw new ApiError("المنطقة الزمنية غير صالحة.");
      try {
        new Intl.DateTimeFormat("ar", { timeZone: v }).format();
      } catch {
        throw new ApiError("المنطقة الزمنية غير صالحة.");
      }
      value.timezone = v;
    } else if (key === "studyMinutes") value.studyMinutes = num(v, 1, 480, 60);
    else if (
      [
        "personalization",
        "reducedMotion",
        "habitReminder",
        "deadlineNotifications",
        "onboardingDone",
        "journalEnabled",
      ].includes(key)
    )
      value[key] = bool(v);
    else throw new ApiError("إعداد غير معروف.");
  }
  return savePreferences(userId, value);
}
