"use client";
import { useState } from "react";
import {
  useEvolution,
  useSaver,
  SectionTitle,
  Boundary,
  FormError,
  Empty,
  dayLabel,
} from "./shared";
import { adherence } from "./derive";
import {
  MILESTONE_DAYS,
  cycleDay,
  cycleEnd,
  PILLAR_LABELS,
  type PillarKey,
} from "@/lib/evolution";
import { dateLabel, number } from "@/lib/format";
import type { EvoCycle } from "@/lib/types";
import { Button } from "../ui";

function Milestone({ cycle, day }: { cycle: EvoCycle; day: 1 | 30 | 60 | 90 }) {
  const { state } = useEvolution();
  const saver = useSaver();
  const existing = state.evoMilestones.find(
    (m) => m.cycleId === cycle.id && m.day === day,
  );
  const [text, setText] = useState(existing?.reflection || "");
  const readOnly = cycle.state === "archived";
  return (
    <form
      className="evo-milestone"
      onSubmit={(e) => {
        e.preventDefault();
        saver.create(
          "evoMilestones",
          { cycleId: cycle.id, day, reflection: text },
          "حُفظ تأمّل المحطة.",
        );
      }}
    >
      <label className="field">
        <span>محطة اليوم {number(day)}</span>
        <textarea
          rows={2}
          value={text}
          maxLength={10000}
          readOnly={readOnly}
          onChange={(e) => setText(e.target.value)}
          placeholder="ما الذي لاحظته؟ ما الذي تريد تعديله؟ (اختياري)"
        />
      </label>
      {!readOnly && (
        <Button type="submit" variant="secondary" loading={saver.busy}>
          احفظ
        </Button>
      )}
      <FormError error={saver.error} />
    </form>
  );
}

export default function ReportPage() {
  const { state, cycle, timezone } = useEvolution();
  const cycles = [...state.evoCycles].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  );
  const [selectedId, setSelectedId] = useState(
    cycle?.id || cycles[0]?.id || "",
  );
  const selected = cycles.find((c) => c.id === selectedId);
  if (!selected)
    return (
      <Empty title="لا دورات بعد">
        ابدأ دورة لتظهر هنا تقارير مبنية على سجلاتك فقط.
      </Empty>
    );
  const end = cycleEnd(selected.startDate);
  const todayLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const windowEnd = todayLocal < end ? todayLocal : end;
  const inCycle = (d: string) => d >= selected.startDate && d <= end;
  const daily = state.evoDaily.filter((d) => d.cycleId === selected.id);
  const workouts = state.evoWorkouts.filter(
    (w) => w.status === "completed" && inCycle(w.date),
  );
  const rests = state.evoRestDays.filter((r) => inCycle(r.date));
  const adh =
    windowEnd >= selected.startDate
      ? adherence(state, selected.startDate, windowEnd)
      : { planned: 0, taken: 0, skipped: 0, postponed: 0 };
  const care = (p: "skin" | "hair") => ({
    events: state.evoRoutineEvents.filter(
      (e) => e.pillar === p && inCycle(e.date),
    ).length,
    observations: state.evoObservations.filter(
      (o) => o.pillar === p && inCycle(o.date),
    ).length,
    irritation: [...state.evoRoutineEvents, ...state.evoObservations].filter(
      (x) => x.pillar === p && x.irritation && inCycle(x.date),
    ).length,
    photos: state.evoPhotos.filter((x) => x.pillar === p && inCycle(x.date))
      .length,
  });
  const skin = care("skin"),
    hair = care("hair");
  const weekly = state.evoWeekly.filter((w) => w.cycleId === selected.id);
  const status = (s: string) => daily.filter((d) => d.status === s).length;
  const rows: {
    pillar: PillarKey | "compass";
    label: string;
    facts: string[];
  }[] = [
    {
      pillar: "compass",
      label: "البوصلة اليومية",
      facts: [
        `${number(daily.filter((d) => d.focus).length)} يومًا اخترت فيها خطوة`,
        `تمّ ${number(status("done"))} · راحة ${number(status("rest"))} · تأجيل ${number(status("postponed"))} · تخطٍّ ${number(status("skipped"))}`,
      ],
    },
    {
      pillar: "fitness",
      label: PILLAR_LABELS.fitness,
      facts: [
        `${number(workouts.length)} جلسة مكتملة`,
        `${number(rests.length)} يوم راحة مسجّل`,
      ],
    },
    {
      pillar: "supplements",
      label: PILLAR_LABELS.supplements,
      facts: adh.planned
        ? [
            `أُخذ ${number(adh.taken)} من ${number(adh.planned)} موعدًا مخطّطًا`,
            `تخطٍّ ${number(adh.skipped)} · تأجيل ${number(adh.postponed)}`,
          ]
        : ["لا مواعيد مخطّطة في هذه الفترة"],
    },
    {
      pillar: "skin",
      label: PILLAR_LABELS.skin,
      facts: [
        `${number(skin.events)} سجل استخدام · ${number(skin.observations)} ملاحظة · ${number(skin.photos)} صورة`,
        skin.irritation
          ? `${number(skin.irritation)} إشارة تهيّج مسجّلة`
          : "لا إشارات تهيّج مسجّلة",
      ],
    },
    {
      pillar: "hair",
      label: PILLAR_LABELS.hair,
      facts: [
        `${number(hair.events)} سجل · ${number(hair.observations)} ملاحظة · ${number(hair.photos)} صورة`,
        hair.irritation
          ? `${number(hair.irritation)} إشارة تهيّج مسجّلة`
          : "لا إشارات تهيّج مسجّلة",
      ],
    },
    {
      pillar: "balance",
      label: PILLAR_LABELS.balance,
      facts: [`${number(weekly.length)} مراجعة أسبوعية`],
    },
  ];
  const day = cycleDay(selected.startDate, todayLocal);
  return (
    <div className="evo-pillar-page">
      <div className="evo-pillar-intro">
        <div>
          <h2>تقرير الدورة</h2>
          <p className="muted">
            أعداد من سجلاتك المحفوظة فقط، مع الفترة والمقام. لا درجة تحوّل ولا
            «مؤشر عافية».
          </p>
        </div>
        {cycles.length > 1 && (
          <label className="field">
            <span>الدورة</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {dateLabel(c.startDate, undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  ·{" "}
                  {
                    {
                      draft: "مسودة",
                      active: "نشطة",
                      paused: "متوقفة",
                      completed: "مكتملة",
                      archived: "مؤرشفة",
                    }[c.state]
                  }
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="evo-report-window">
        الفترة: {dateLabel(selected.startDate)} —{" "}
        {dateLabel(
          windowEnd >= selected.startDate ? windowEnd : selected.startDate,
        )}{" "}
        · {dayLabel(day)}
      </p>
      <div className="evo-report-grid">
        {rows
          .filter(
            (r) =>
              r.pillar === "compass" || selected.pillars[r.pillar as PillarKey],
          )
          .map((r) => (
            <section key={r.pillar} className="evo-report-card">
              <h3>{r.label}</h3>
              {r.facts.map((f) => (
                <p key={f}>{f}</p>
              ))}
            </section>
          ))}
        {selected.pillars.wellbeing && (
          <section className="evo-report-card">
            <h3>{PILLAR_LABELS.wellbeing}</h3>
            <p>خاص: لا تلخيص للمزاج في التقرير.</p>
            <p>
              {number(state.evoWellbeing.filter((w) => inCycle(w.date)).length)}{" "}
              تسجيل اختياري
            </p>
          </section>
        )}
      </div>
      <Boundary>
        غياب التحسّن الظاهر ليس فشلًا. هذه أرقام سلوك مسجّل، ولا تعني نتيجة طبية أو
        شكلية.
      </Boundary>
      <section className="evo-panel" aria-labelledby="milestones-title">
        <SectionTitle
          title="المحطات"
          kicker="الأيام ١ و٣٠ و٦٠ و٩٠ — اختيارية"
        />
        {MILESTONE_DAYS.map((m) => (
          <Milestone key={m} cycle={selected} day={m} />
        ))}
      </section>
    </div>
  );
}
