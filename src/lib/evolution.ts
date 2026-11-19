/**
 * MQW 90 — deterministic calendar/recurrence helpers shared by client and server.
 * All "days" are local calendar dates (YYYY-MM-DD) and are computed with UTC
 * date arithmetic on the date string itself, never by adding seconds to a local
 * midnight, so DST transitions cannot shift a day number.
 */
export const CYCLE_LENGTH = 90;
export const PILLARS = [
  "skin",
  "hair",
  "supplements",
  "fitness",
  "wellbeing",
  "balance",
] as const;
export type PillarKey = (typeof PILLARS)[number];
export const PILLAR_LABELS: Record<PillarKey, string> = {
  skin: "البشرة",
  hair: "الشعر واللحية",
  supplements: "المكمّلات",
  fitness: "التمرين PPL",
  wellbeing: "الرفاه النفسي",
  balance: "الاتزان الحياتي",
};
export const CYCLE_STATES = [
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
] as const;
export type CycleState = (typeof CYCLE_STATES)[number];
export const MILESTONE_DAYS = [1, 30, 60, 90] as const;
export const BALANCE_DOMAINS = [
  "التعلّم الأكاديمي",
  "الصحة الشخصية",
  "التمرين",
  "الرفاه النفسي",
  "العلاقات",
  "العمل والمشاريع",
  "الراحة والترفيه",
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !DAY.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function toUtc(day: string) {
  if (!isDay(day)) throw new Error("Invalid calendar day");
  return Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
}
export function addDays(day: string, n: number): string {
  return new Date(toUtc(day) + n * 86400000).toISOString().slice(0, 10);
}
/** Whole calendar days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}
/** Local calendar date for an instant in an IANA time zone. */
export function localDate(timezone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
/** 0 = Sunday … 6 = Saturday for a calendar day (time-zone independent). */
export function weekday(day: string): number {
  return new Date(toUtc(day)).getUTCDay();
}
/** Weeks start on Saturday, matching the common Arab-region calendar. */
export function weekStart(day: string): string {
  return addDays(day, -((weekday(day) + 1) % 7));
}
export function cycleEnd(startDate: string): string {
  return addDays(startDate, CYCLE_LENGTH - 1);
}
/**
 * Day 1 is the start date, Day 90 the end date. Returns a number outside 1–90
 * before the start (≤ 0) or after the end (> 90); callers label those states.
 */
export function cycleDay(startDate: string, today: string): number {
  return daysBetween(startDate, today) + 1;
}
export type Phase = {
  key: "foundation" | "adjustment" | "evaluation";
  label: string;
  from: number;
  to: number;
};
export const PHASES: Phase[] = [
  { key: "foundation", label: "التأسيس", from: 1, to: 30 },
  { key: "adjustment", label: "التعديل", from: 31, to: 60 },
  { key: "evaluation", label: "التأمل والتقييم", from: 61, to: 90 },
];
export function phaseFor(day: number): Phase | null {
  return PHASES.find((p) => day >= p.from && day <= p.to) || null;
}

export type Schedule =
  | { kind: "daily"; times?: string[] }
  | { kind: "weekdays"; weekdays: number[]; times?: string[] }
  | { kind: "interval"; every: number; times?: string[] }
  | { kind: "as_needed"; times?: string[] };
export type ScheduleVersion = {
  version: number;
  from: string;
  schedule: Schedule;
};
/** Whether a schedule has a planned occurrence on `day`. */
export function occursOn(
  schedule: Schedule,
  anchor: string,
  day: string,
  endDate?: string | null,
): boolean {
  if (!isDay(anchor) || !isDay(day)) return false;
  if (daysBetween(anchor, day) < 0) return false;
  if (endDate && isDay(endDate) && daysBetween(endDate, day) > 0) return false;
  switch (schedule.kind) {
    case "daily":
      return true;
    case "weekdays":
      return schedule.weekdays.includes(weekday(day));
    case "interval":
      return daysBetween(anchor, day) % Math.max(1, schedule.every) === 0;
    default:
      return false;
  }
}
/** The schedule version in force on a given day (history is never rewritten). */
export function versionOn(
  history: ScheduleVersion[],
  day: string,
): ScheduleVersion | undefined {
  return [...history]
    .filter((v) => daysBetween(v.from, day) >= 0)
    .sort((a, b) => b.version - a.version)[0];
}
export function plannedSlots(
  history: ScheduleVersion[],
  startDate: string,
  day: string,
  endDate?: string | null,
): { version: number; time: string }[] {
  const v = versionOn(history, day);
  if (!v) return [];
  // Interval schedules stay anchored to the supplement start date, not to the edit date.
  if (!occursOn(v.schedule, startDate, day, endDate)) return [];
  const times = v.schedule.times?.length ? v.schedule.times : [""];
  return times.map((time) => ({ version: v.version, time }));
}
export function upcomingDays(
  schedule: Schedule,
  anchor: string,
  from: string,
  count: number,
  endDate?: string | null,
  horizon = 400,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < horizon && out.length < count; i++) {
    const day = addDays(from, i);
    if (occursOn(schedule, anchor, day, endDate)) out.push(day);
  }
  return out;
}
export const WEEKDAY_LABELS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];
export function describeSchedule(schedule: Schedule): string {
  const times = schedule.times?.filter(Boolean).length
    ? ` · ${schedule.times.filter(Boolean).join("، ")}`
    : "";
  switch (schedule.kind) {
    case "daily":
      return `يوميًا${times}`;
    case "weekdays":
      return `${schedule.weekdays.map((d) => WEEKDAY_LABELS[d]).join("، ")}${times}`;
    case "interval":
      return `كل ${schedule.every} أيام${times}`;
    default:
      return "عند الحاجة، دون جدول";
  }
}

export type WorkoutSet = {
  id: string;
  exerciseId?: string;
  exerciseName: string;
  reps?: number | null;
  load?: number | null;
  unit: "kg" | "lb";
  rpe?: number | null;
  rir?: number | null;
  restSeconds?: number | null;
  note?: string;
};
/** Volume load counts only sets where both weight and reps were recorded. */
export function volumeLoad(
  sets: WorkoutSet[],
  unit: "kg" | "lb" = "kg",
): number {
  let total = 0;
  for (const s of sets) {
    if (typeof s.load !== "number" || typeof s.reps !== "number") continue;
    const load =
      s.unit === unit
        ? s.load
        : unit === "kg"
          ? s.load * 0.45359237
          : s.load / 0.45359237;
    total += load * s.reps;
  }
  return Math.round(total * 10) / 10;
}
/** A trend is only shown with at least this many dated measurements. */
export const MIN_TREND_POINTS = 3;
