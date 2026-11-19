import { plannedSlots, weekStart, daysBetween } from "@/lib/evolution";
import type { AppState, EvoIntake, EvoSupplement } from "@/lib/types";

export type DueSlot = {
  supplement: EvoSupplement;
  time: string;
  version: number;
  intake?: EvoIntake;
};
/** Planned slots for a local day, joined with what was actually recorded. Nothing is invented. */
export function slotsForDay(state: AppState, day: string): DueSlot[] {
  const out: DueSlot[] = [];
  for (const s of state.evoSupplements) {
    if (s.status !== "active") continue;
    for (const slot of plannedSlots(
      s.scheduleHistory,
      s.startDate,
      day,
      s.endDate,
    )) {
      out.push({
        supplement: s,
        ...slot,
        intake: state.evoIntakes.find(
          (i) =>
            i.supplementId === s.id && i.date === day && i.time === slot.time,
        ),
      });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}
/** Adherence over a window with an explicit denominator (planned slots only). */
export function adherence(state: AppState, from: string, to: string) {
  let planned = 0,
    taken = 0,
    skipped = 0,
    postponed = 0;
  for (let d = 0; d <= daysBetween(from, to); d++) {
    const day = new Date(Date.parse(from + "T00:00:00Z") + d * 86400000)
      .toISOString()
      .slice(0, 10);
    for (const slot of slotsForDay(state, day)) {
      planned++;
      if (slot.intake?.status === "taken") taken++;
      else if (slot.intake?.status === "skipped") skipped++;
      else if (slot.intake?.status === "postponed") postponed++;
    }
  }
  return { planned, taken, skipped, postponed };
}
export function thisWeek(today: string) {
  return weekStart(today);
}
export const STATUS_LABELS: Record<string, string> = {
  planned: "مخطّط",
  done: "تمّ",
  rest: "راحة",
  skipped: "تخطّيت",
  postponed: "مؤجّل",
  not_applicable: "لا ينطبق",
  taken: "أُخذ",
  in_progress: "جارية",
  completed: "مكتملة",
  interrupted: "متوقفة",
};
