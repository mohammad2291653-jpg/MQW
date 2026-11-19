"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock3,
  Coffee,
  Droplets,
  Dumbbell,
  HeartHandshake,
  Pill,
  Scale as ScaleIcon,
  Scissors,
  SkipForward,
  Target,
  CalendarClock,
  Ban,
} from "lucide-react";
import { useEvolution, useSaver, FormError, SectionTitle } from "./shared";
import { slotsForDay, thisWeek, STATUS_LABELS } from "./derive";
import { MILESTONE_DAYS, PILLAR_LABELS, type PillarKey } from "@/lib/evolution";
import { number } from "@/lib/format";
import type { EvoDailyStatus } from "@/lib/types";
import { Button } from "../ui";

const STATUS_ACTIONS: {
  value: EvoDailyStatus;
  label: string;
  icon: typeof Check;
}[] = [
  { value: "done", label: "تمّ", icon: Check },
  { value: "rest", label: "يوم راحة", icon: Coffee },
  { value: "postponed", label: "أؤجّلها", icon: CalendarClock },
  { value: "skipped", label: "تخطٍّ", icon: SkipForward },
  { value: "not_applicable", label: "لا ينطبق", icon: Ban },
];
const PILLAR_ICONS: Record<PillarKey, typeof Droplets> = {
  skin: Droplets,
  hair: Scissors,
  supplements: Pill,
  fitness: Dumbbell,
  wellbeing: HeartHandshake,
  balance: ScaleIcon,
};

export default function Overview() {
  const { state, cycle, today, day, enabled } = useEvolution();
  const saver = useSaver();
  const daily = state.evoDaily.find(
    (d) => d.cycleId === cycle!.id && d.date === today,
  );
  const [focus, setFocus] = useState(daily?.focus || "");
  const slots = enabled("supplements") ? slotsForDay(state, today) : [];
  const openWorkout = state.evoWorkouts.find((w) => w.status === "in_progress");
  const restToday = state.evoRestDays.some((r) => r.date === today);
  const week = thisWeek(today);
  const weekly = state.evoWeekly.find(
    (w) => w.cycleId === cycle!.id && w.weekStart === week,
  );
  const milestone = MILESTONE_DAYS.find((m) => Math.abs(day - m) <= 2);
  const milestoneDone =
    milestone &&
    state.evoMilestones.some(
      (m) => m.cycleId === cycle!.id && m.day === milestone,
    );
  const goalOptions = cycle!.goals.map((g) => g.title);

  const counts: Record<PillarKey, string> = {
    skin: `${number(state.evoObservations.filter((o) => o.pillar === "skin").length)} ملاحظة · ${number(state.evoRoutineEvents.filter((e) => e.pillar === "skin").length)} استخدام`,
    hair: `${number(state.evoRoutineEvents.filter((e) => e.pillar === "hair").length)} سجل · ${number(state.evoObservations.filter((o) => o.pillar === "hair").length)} ملاحظة`,
    supplements: `${number(state.evoSupplements.filter((s) => s.status === "active").length)} نشط · ${number(slots.length)} مخطّط اليوم`,
    fitness: `${number(state.evoWorkouts.filter((w) => w.status === "completed").length)} جلسة مكتملة`,
    wellbeing: "خاص — لا معاينة هنا",
    balance: `${number(state.evoWeekly.filter((w) => w.cycleId === cycle!.id).length)} مراجعة أسبوعية`,
  };

  async function saveDaily(values: Record<string, unknown>, msg?: string) {
    const payload = {
      cycleId: cycle!.id,
      date: today,
      focus,
      status: daily?.status || "planned",
      ...values,
    };
    await saver.create("evoDaily", payload, msg);
  }

  return (
    <div className="evo-overview">
      <section className="evo-compass" aria-labelledby="compass-title">
        <div className="evo-compass-head">
          <span className="evo-kicker">البوصلة اليومية</span>
          <h2 id="compass-title">خطوتي اليوم</h2>
          <p className="muted">
            أولوية واحدة تختارها بنفسك. الراحة والتأجيل خيارات مشروعة، لا فشل.
          </p>
        </div>
        <form
          className="evo-compass-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!focus.trim())
              return saver.setError("اكتب خطوة واحدة، أو اختر من أهدافك.");
            saveDaily({ focus: focus.trim() }, "حُفظت خطوتك لليوم.");
          }}
        >
          <label className="field">
            <span>ما الخطوة المفيدة الواحدة اليوم؟</span>
            <input
              value={focus}
              maxLength={300}
              list="evo-goal-options"
              onChange={(e) => setFocus(e.target.value)}
              placeholder="مثلًا: جلسة Pull قصيرة"
            />
            <datalist id="evo-goal-options">
              {goalOptions.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <Button type="submit" loading={saver.busy}>
            {daily?.focus ? "حدّث الخطوة" : "اختر خطوتي"}
          </Button>
        </form>
        {daily?.focus && (
          <div className="evo-compass-status">
            <p>
              <Target size={16} aria-hidden="true" />{" "}
              <strong>{daily.focus}</strong> ·{" "}
              <span>{STATUS_LABELS[daily.status]}</span>
            </p>
            <div
              className="evo-status-row"
              role="group"
              aria-label="حالة خطوة اليوم"
            >
              {STATUS_ACTIONS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  className={`evo-status ${daily.status === a.value ? "on" : ""}`}
                  aria-pressed={daily.status === a.value}
                  onClick={() =>
                    saveDaily({ status: a.value }, `سُجّلت الحالة: ${a.label}.`)
                  }
                >
                  <a.icon size={15} aria-hidden="true" /> {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <FormError error={saver.error} />
      </section>

      <div className="evo-overview-grid">
        <section className="evo-today-list" aria-labelledby="today-actions">
          <SectionTitle title="ما هو مُخطّط فعلًا اليوم" kicker="من سجلاتك فقط" />
          <ul>
            {slots.map((s) => (
              <li key={`${s.supplement.id}-${s.time}`}>
                <Pill size={16} aria-hidden="true" />
                <span>
                  {s.supplement.name}
                  {s.time && <small dir="ltr"> {s.time}</small>}
                </span>
                <span className={`evo-state ${s.intake?.status || "planned"}`}>
                  {STATUS_LABELS[s.intake?.status || "planned"]}
                </span>
              </li>
            ))}
            {openWorkout && (
              <li>
                <Dumbbell size={16} aria-hidden="true" />
                <span>جلسة {openWorkout.templateName} غير مكتملة</span>
                <Link
                  className="text-link"
                  href={`/evolution/fitness/session/${openWorkout.id}`}
                >
                  تابع <ArrowLeft size={14} />
                </Link>
              </li>
            )}
            {restToday && (
              <li>
                <Coffee size={16} aria-hidden="true" />
                <span>يوم راحة مسجّل للتمرين</span>
              </li>
            )}
            {!slots.length && !openWorkout && !restToday && (
              <li className="evo-muted-row">
                لا يوجد شيء مُجدول لهذا اليوم. أضف ما تريد من الأقسام، أو استمتع
                بيومك.
              </li>
            )}
          </ul>
          {slots.length > 0 && (
            <Link className="text-link" href="/evolution/supplements">
              سجّل الأخذ أو التخطي <ArrowLeft size={14} />
            </Link>
          )}
        </section>
        <section className="evo-reflect-card" aria-labelledby="reflect-title">
          <SectionTitle title="لحظات التأمل" kicker="اختيارية دائمًا" />
          <Link href="/evolution/weekly" className="evo-reflect-link">
            <Clock3 size={18} aria-hidden="true" />
            <span>
              <strong>مراجعة الأسبوع</strong>
              <small>
                {weekly
                  ? "حُفظت مراجعة هذا الأسبوع."
                  : "خمس دقائق، ثلاثة أسئلة قصيرة."}
              </small>
            </span>
          </Link>
          {milestone && (
            <Link href="/evolution/report" className="evo-reflect-link">
              <Target size={18} aria-hidden="true" />
              <span>
                <strong>محطة اليوم {number(milestone)}</strong>
                <small>
                  {milestoneDone
                    ? "كتبت تأملك لهذه المحطة."
                    : "تأمل قصير اختياري، يمكنك تخطيه."}
                </small>
              </span>
            </Link>
          )}
        </section>
      </div>

      <section aria-labelledby="pillars-title">
        <SectionTitle title="أقسام رحلتك" kicker="سجلات حقيقية، لا نسب إنجاز" />
        <div
          className="evo-pillars"
          data-count={
            (Object.keys(PILLAR_LABELS) as PillarKey[]).filter((p) =>
              enabled(p),
            ).length
          }
        >
          {(Object.keys(PILLAR_LABELS) as PillarKey[])
            .filter((p) => enabled(p))
            .map((p) => {
              const Icon = PILLAR_ICONS[p];
              return (
                <Link
                  key={p}
                  href={`/evolution/${p}`}
                  className={`evo-pillar evo-pillar-${p}`}
                >
                  <span className="evo-pillar-icon">
                    <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <strong>{PILLAR_LABELS[p]}</strong>
                  <small>{counts[p]}</small>
                </Link>
              );
            })}
        </div>
      </section>
      {cycle!.goals.length > 0 && (
        <section className="evo-goals" aria-labelledby="goals-title">
          <SectionTitle
            title="أهدافك الرئيسية"
            kicker="اخترتها بنفسك"
            action={
              <Link className="text-link" href="/evolution/settings">
                عدّل
              </Link>
            }
          />
          <ol>
            {cycle!.goals.map((g) => (
              <li key={g.id}>{g.title}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
