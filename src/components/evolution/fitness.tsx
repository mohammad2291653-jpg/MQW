"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Plus,
  Play,
  Coffee,
  Dumbbell,
  ArrowRight,
  Check,
  Pause,
  Pencil,
  Archive,
} from "lucide-react";
import {
  useEvolution,
  useSaver,
  PillarOff,
  SectionTitle,
  Boundary,
  FormError,
  ConfirmDelete,
  Empty,
  Scale,
} from "./shared";
import { TrendChart } from "./trend";
import { PhotoTimeline } from "./photos";
import { STATUS_LABELS } from "./derive";
import { volumeLoad, type WorkoutSet } from "@/lib/evolution";
import { dateLabel, number } from "@/lib/format";
import type { EvoTemplate, EvoWorkout } from "@/lib/types";
import { Button } from "../ui";
import { request } from "../app-provider";

const TYPE_LABEL: Record<string, string> = {
  push: "Push · دفع",
  pull: "Pull · سحب",
  legs: "Legs · أرجل",
  custom: "مخصص",
  free: "جلسة حرة",
};
const STARTER: {
  name: string;
  muscleGroup: string;
  type: "push" | "pull" | "legs";
}[] = [
  { name: "ضغط صدر بالبار", muscleGroup: "الصدر", type: "push" },
  { name: "ضغط كتف علوي", muscleGroup: "الأكتاف", type: "push" },
  { name: "تمديد ترايسبس", muscleGroup: "الترايسبس", type: "push" },
  { name: "سحب علوي", muscleGroup: "الظهر", type: "pull" },
  { name: "تجديف بالدمبل", muscleGroup: "الظهر", type: "pull" },
  { name: "ثني بايسبس", muscleGroup: "البايسبس", type: "pull" },
  { name: "سكوات", muscleGroup: "الأرجل", type: "legs" },
  { name: "رفعة رومانية", muscleGroup: "الخلفية", type: "legs" },
  { name: "رفع سمانة", muscleGroup: "السمانة", type: "legs" },
];
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function Session({ workout }: { workout: EvoWorkout }) {
  const { state } = useEvolution();
  const saver = useSaver();
  const template = state.evoTemplates.find((t) => t.id === workout.templateId);
  const library = state.evoExercises.filter((e) => !e.archived);
  const planned = (template?.exerciseIds || [])
    .map((id) => state.evoExercises.find((e) => e.id === id))
    .filter(Boolean) as typeof library;
  const [extra, setExtra] = useState<string[]>([]);
  const names = Array.from(
    new Set([
      ...planned.map((e) => e.name),
      ...workout.sets.map((s) => s.exerciseName),
      ...extra,
    ]),
  );
  const [drafts, setDrafts] = useState<
    Record<
      string,
      { reps: string; load: string; unit: "kg" | "lb"; rpe: string }
    >
  >({});
  const [editing, setEditing] = useState<string | null>(null);
  const [finish, setFinish] = useState({
    recovery: null as number | null,
    painNote: workout.painNote || "",
    notes: workout.notes || "",
  });
  const done = workout.status === "completed";
  const draft = (n: string) =>
    drafts[n] || {
      reps: "",
      load: "",
      unit:
        (workout.sets.findLast?.((s) => s.exerciseName === n)?.unit as
          "kg" | "lb") || "kg",
      rpe: "",
    };
  const toNum = (v: string) => (v.trim() === "" ? null : Number(v));
  async function saveSets(sets: WorkoutSet[], msg: string) {
    return saver.update("evoWorkouts", workout.id, { sets }, msg);
  }
  async function addSet(name: string) {
    const d = draft(name);
    if (d.reps.trim() === "" && d.load.trim() === "")
      return saver.setError("أدخل التكرارات أو الوزن على الأقل.");
    const ex = state.evoExercises.find((e) => e.name === name);
    const set: WorkoutSet = {
      id: editing || uid(),
      exerciseId: ex?.id,
      exerciseName: name,
      reps: toNum(d.reps),
      load: toNum(d.load),
      unit: d.unit,
      rpe: toNum(d.rpe),
    };
    const sets = editing
      ? workout.sets.map((s) => (s.id === editing ? set : s))
      : [...workout.sets, set];
    const ok = await saveSets(
      sets,
      editing ? "عُدّلت المجموعة." : "حُفظت المجموعة.",
    );
    if (ok) {
      setDrafts({ ...drafts, [name]: { ...d, reps: "", rpe: "" } });
      setEditing(null);
    }
  }
  return (
    <div className="evo-session">
      <Link href="/evolution/fitness" className="text-link">
        <ArrowRight size={14} /> كل التمارين
      </Link>
      <div className="evo-pillar-intro">
        <div>
          <h2>
            {workout.templateName}{" "}
            <span className="evo-badge">{STATUS_LABELS[workout.status]}</span>
          </h2>
          <p className="muted">
            {dateLabel(workout.date)} · {number(workout.sets.length)} مجموعة ·
            حجم التحميل {number(volumeLoad(workout.sets))} كغ
          </p>
        </div>
      </div>
      {!done && (
        <Boundary tone="care">
          توقّف إذا شعرت بألم حاد أو لم تتعافَ جيدًا. لا زيادة تلقائية في الأوزان.
          استشر مدربًا أو مختصًا عند الحاجة.
        </Boundary>
      )}
      {names.map((name) => {
        const sets = workout.sets.filter((s) => s.exerciseName === name);
        const d = draft(name);
        return (
          <section key={name} className="evo-panel evo-exercise">
            <h3>{name}</h3>
            {sets.length > 0 && (
              <ol className="evo-sets">
                {sets.map((s, i) => (
                  <li key={s.id} className={editing === s.id ? "editing" : ""}>
                    <span className="evo-set-no">{number(i + 1)}</span>
                    <span dir="ltr">
                      {s.reps ?? "–"} × {s.load ?? "–"} {s.unit}
                      {s.rpe ? ` · RPE ${s.rpe}` : ""}
                    </span>
                    {!done && (
                      <>
                        <button
                          type="button"
                          className="evo-icon-btn"
                          aria-label={`تعديل المجموعة ${i + 1}`}
                          onClick={() => {
                            setEditing(s.id);
                            setDrafts({
                              ...drafts,
                              [name]: {
                                reps: s.reps?.toString() || "",
                                load: s.load?.toString() || "",
                                unit: s.unit,
                                rpe: s.rpe?.toString() || "",
                              },
                            });
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <ConfirmDelete
                          compact
                          label={`المجموعة ${i + 1}`}
                          onConfirm={() =>
                            saveSets(
                              workout.sets.filter((x) => x.id !== s.id),
                              "حُذفت المجموعة.",
                            )
                          }
                        />
                      </>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {!done && (
              <form
                className="evo-set-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  addSet(name);
                }}
              >
                <label>
                  <span>تكرارات</span>
                  <input
                    inputMode="numeric"
                    type="number"
                    min={0}
                    max={1000}
                    value={d.reps}
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [name]: { ...d, reps: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  <span>الوزن</span>
                  <input
                    inputMode="decimal"
                    type="number"
                    min={0}
                    max={2000}
                    step="0.5"
                    value={d.load}
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [name]: { ...d, load: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  <span>الوحدة</span>
                  <select
                    value={d.unit}
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [name]: { ...d, unit: e.target.value as "kg" | "lb" },
                      })
                    }
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </label>
                <label>
                  <span>RPE</span>
                  <input
                    inputMode="decimal"
                    type="number"
                    min={1}
                    max={10}
                    step="0.5"
                    value={d.rpe}
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [name]: { ...d, rpe: e.target.value },
                      })
                    }
                  />
                </label>
                <Button
                  type="submit"
                  loading={saver.busy}
                  aria-label={`احفظ مجموعة ${name}`}
                >
                  {editing && sets.some((s) => s.id === editing)
                    ? "حدّث"
                    : "احفظ المجموعة"}
                </Button>
              </form>
            )}
          </section>
        );
      })}
      {!done && (
        <div className="evo-add-exercise">
          <label className="field">
            <span>أضف تمرينًا لهذه الجلسة</span>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setExtra([...extra, e.target.value]);
              }}
            >
              <option value="">اختر من مكتبتك…</option>
              {library
                .filter((e) => !names.includes(e.name))
                .map((e) => (
                  <option key={e.id} value={e.name}>
                    {e.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}
      <FormError error={saver.error} />
      {!done && (
        <section className="evo-panel stack">
          <h3>إنهاء الجلسة</h3>
          <Scale
            label="كيف تشعر بالاستشفاء؟ (اختياري)"
            value={finish.recovery}
            onChange={(r) => setFinish({ ...finish, recovery: r })}
            low="مُرهق"
            high="متعافٍ"
          />
          <label className="field">
            <span>ألم أو انزعاج (اختياري)</span>
            <input
              value={finish.painNote}
              maxLength={1000}
              onChange={(e) =>
                setFinish({ ...finish, painNote: e.target.value })
              }
            />
          </label>
          <div className="evo-actions">
            <Button
              loading={saver.busy}
              onClick={() =>
                saver.update(
                  "evoWorkouts",
                  workout.id,
                  {
                    status: "completed",
                    recovery: finish.recovery,
                    painNote: finish.painNote,
                  },
                  "اكتملت الجلسة وحُفظت.",
                )
              }
            >
              <Check size={16} /> أنهِ الجلسة
            </Button>
            {workout.status === "in_progress" ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  saver.update(
                    "evoWorkouts",
                    workout.id,
                    { status: "interrupted" },
                    "أُوقفت الجلسة؛ يمكنك متابعتها لاحقًا.",
                  )
                }
              >
                <Pause size={16} /> أوقفها مؤقتًا
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  saver.update(
                    "evoWorkouts",
                    workout.id,
                    { status: "in_progress" },
                    "استُؤنفت الجلسة.",
                  )
                }
              >
                <Play size={16} /> تابع الجلسة
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function TemplateEditor({ template }: { template: EvoTemplate }) {
  const { state } = useEvolution();
  const saver = useSaver();
  const lib = state.evoExercises.filter((e) => !e.archived);
  return (
    <div className="evo-template-editor">
      <ul className="evo-chips">
        {template.exerciseIds.map((id) => {
          const e = state.evoExercises.find((x) => x.id === id);
          return (
            <li key={id} className="evo-chip on">
              {e?.name || "تمرين"}
              <button
                type="button"
                aria-label={`إزالة ${e?.name}`}
                onClick={() =>
                  saver.update(
                    "evoTemplates",
                    template.id,
                    {
                      exerciseIds: template.exerciseIds.filter((x) => x !== id),
                    },
                    "",
                  )
                }
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <select
        aria-label={`أضف تمرينًا إلى ${template.name}`}
        value=""
        onChange={(e) =>
          e.target.value &&
          saver.update(
            "evoTemplates",
            template.id,
            { exerciseIds: [...template.exerciseIds, e.target.value] },
            "",
          )
        }
      >
        <option value="">+ أضف تمرينًا</option>
        {lib
          .filter((e) => !template.exerciseIds.includes(e.id))
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
      </select>
      <FormError error={saver.error} />
    </div>
  );
}

export default function FitnessPage({ sessionId }: { sessionId?: string }) {
  const { state, today, cycle, enabled, refresh } = useEvolution();
  const saver = useSaver();
  const router = useRouter();
  const [exName, setExName] = useState("");
  const [exGroup, setExGroup] = useState("");
  const [editTemplates, setEditTemplates] = useState(false);
  const [metric, setMetric] = useState({ value: "", unit: "kg", date: today });
  const [showBody, setShowBody] = useState(state.evoMetrics.length > 0);
  const [trendExercise, setTrendExercise] = useState("");
  const templates = [...state.evoTemplates].sort((a, b) => a.order - b.order);
  const completed = state.evoWorkouts
    .filter((w) => w.status === "completed")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const exerciseNames = useMemo(
    () =>
      Array.from(
        new Set(completed.flatMap((w) => w.sets.map((s) => s.exerciseName))),
      ),
    [completed],
  );
  if (!enabled("fitness")) return <PillarOff label="التمرين" />;
  if (sessionId) {
    const w = state.evoWorkouts.find((x) => x.id === sessionId);
    return w ? <Session workout={w} /> : <Empty title="الجلسة غير موجودة" />;
  }
  const last = completed[0];
  const next =
    last && templates.length
      ? templates[
          (templates.findIndex((t) => t.id === last.templateId) + 1) %
            templates.length
        ]
      : templates[0];
  const open = state.evoWorkouts.filter((w) => w.status !== "completed");
  const restToday = state.evoRestDays.find((r) => r.date === today);

  async function start(t?: EvoTemplate) {
    const w = await saver.create(
      "evoWorkouts",
      {
        templateId: t?.id || null,
        templateName: t?.name || "جلسة حرة",
        type: t?.type || "free",
        date: today,
        startedAt: new Date().toISOString(),
        sets: [],
        cycleId: cycle?.id,
      },
      "بدأت الجلسة.",
    );
    if (w) router.push(`/evolution/fitness/session/${(w as EvoWorkout).id}`);
  }
  /** Creates three editable PPL templates with a factual name-only exercise library (no loads or programmes). */
  async function starter() {
    await saver.run(async () => {
      const ids: Record<string, string[]> = { push: [], pull: [], legs: [] };
      for (const s of STARTER) {
        const existing = state.evoExercises.find((e) => e.name === s.name);
        const ex =
          existing ||
          (await request<{ id: string }>("/api/records/evoExercises", {
            method: "POST",
            body: JSON.stringify({ name: s.name, muscleGroup: s.muscleGroup }),
          }));
        ids[s.type].push(ex.id);
      }
      const names = { push: "Push", pull: "Pull", legs: "Legs" } as const;
      let order = templates.length;
      for (const type of ["push", "pull", "legs"] as const)
        if (!templates.some((t) => t.type === type))
          await request("/api/records/evoTemplates", {
            method: "POST",
            body: JSON.stringify({
              name: names[type],
              type,
              exerciseIds: ids[type],
              order: order++,
            }),
          });
      await refresh();
    }, "أُنشئت قوالب Push / Pull / Legs.");
  }
  const trendName = trendExercise || exerciseNames[0] || "";
  const trendPoints = completed
    .filter((w) =>
      w.sets.some(
        (s) => s.exerciseName === trendName && typeof s.load === "number",
      ),
    )
    .map((w) => ({
      date: w.date,
      value: Math.max(
        ...w.sets
          .filter(
            (s) => s.exerciseName === trendName && typeof s.load === "number",
          )
          .map((s) =>
            s.unit === "lb"
              ? (s.load as number) * 0.45359237
              : (s.load as number),
          ),
      ),
    }))
    .reverse();
  const volumePoints = completed
    .filter((w) => volumeLoad(w.sets) > 0)
    .map((w) => ({ date: w.date, value: volumeLoad(w.sets) }))
    .reverse();
  const weights = state.evoMetrics
    .filter((m) => m.type === "bodyweight")
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="evo-pillar-page">
      <div className="evo-pillar-intro">
        <div>
          <h2>Push · Pull · Legs</h2>
          <p className="muted">
            قوالبك، وسجل مجموعاتك الفعلي، وأيام راحة لا تُحتسب فشلًا.
          </p>
        </div>
        <div className="evo-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!!restToday || saver.busy}
            onClick={() =>
              saver.create(
                "evoRestDays",
                { date: today, cycleId: cycle?.id },
                "سُجّل اليوم يوم راحة.",
              )
            }
          >
            <Coffee size={16} /> {restToday ? "اليوم يوم راحة" : "يوم راحة"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => start()}
          >
            <Play size={16} /> جلسة حرة
          </button>
        </div>
      </div>
      <FormError error={saver.error} />
      {open.length > 0 && (
        <section className="evo-panel evo-resume">
          <SectionTitle title="جلسات لم تكتمل" />
          <ul className="evo-list">
            {open.map((w) => (
              <li key={w.id}>
                <Dumbbell size={18} aria-hidden="true" />
                <div>
                  <strong>{w.templateName}</strong>
                  <small>
                    {dateLabel(w.date)} · {number(w.sets.length)} مجموعة ·{" "}
                    {STATUS_LABELS[w.status]}
                  </small>
                </div>
                <Link
                  className="btn btn-primary"
                  href={`/evolution/fitness/session/${w.id}`}
                >
                  تابع
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="ppl-title">
        <SectionTitle
          title="قوالبك"
          kicker={
            next
              ? `التالي في دورتك: ${next.name}`
              : "ابدأ بقوالب فارغة أو مكتبة بداية"
          }
          action={
            templates.length > 0 && (
              <button
                type="button"
                className="text-link"
                onClick={() => setEditTemplates(!editTemplates)}
                aria-expanded={editTemplates}
              >
                <Pencil size={14} /> {editTemplates ? "تمّ" : "عدّل القوالب"}
              </button>
            )
          }
        />
        {templates.length === 0 ? (
          <div className="evo-empty small">
            <h3>لا قوالب بعد</h3>
            <p>
              أنشئ Push / Pull / Legs مع مكتبة تمارين أساسية (أسماء ومجموعات
              عضلية فقط، دون أوزان أو برامج). يمكنك تعديل كل شيء.
            </p>
            <Button loading={saver.busy} onClick={starter}>
              أنشئ قوالب PPL
            </Button>
          </div>
        ) : (
          <div className="evo-ppl">
            {templates.map((t) => (
              <article
                key={t.id}
                className={`evo-ppl-card evo-ppl-${t.type} ${next?.id === t.id ? "next" : ""}`}
              >
                <span className="evo-ppl-type">{TYPE_LABEL[t.type]}</span>
                <h3>{t.name}</h3>
                <p className="muted small">
                  {t.exerciseIds.length
                    ? t.exerciseIds
                        .map(
                          (id) =>
                            state.evoExercises.find((e) => e.id === id)?.name,
                        )
                        .filter(Boolean)
                        .join("، ")
                    : "لا تمارين بعد"}
                </p>
                {editTemplates ? (
                  <TemplateEditor template={t} />
                ) : (
                  <Button
                    onClick={() => start(t)}
                    loading={saver.busy}
                    variant={next?.id === t.id ? "primary" : "secondary"}
                  >
                    <Play size={15} /> ابدأ {t.name}
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="evo-two-col">
        <section className="evo-panel" aria-labelledby="library-title">
          <SectionTitle title="مكتبة التمارين" />
          <form
            className="evo-inline-add"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await saver.create(
                  "evoExercises",
                  { name: exName, muscleGroup: exGroup },
                  "أُضيف التمرين.",
                )
              ) {
                setExName("");
                setExGroup("");
              }
            }}
          >
            <label className="field">
              <span>اسم التمرين</span>
              <input
                value={exName}
                onChange={(e) => setExName(e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label className="field">
              <span>المجموعة العضلية</span>
              <input
                value={exGroup}
                onChange={(e) => setExGroup(e.target.value)}
                maxLength={100}
              />
            </label>
            <Button type="submit" variant="secondary" loading={saver.busy}>
              <Plus size={15} /> أضف
            </Button>
          </form>
          <ul className="evo-list compact">
            {state.evoExercises.map((e) => (
              <li key={e.id} className={e.archived ? "dim" : ""}>
                <div>
                  <strong>{e.name}</strong>
                  <small>
                    {[e.muscleGroup, e.archived && "مؤرشف"]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </div>
                <button
                  type="button"
                  className="evo-icon-btn"
                  aria-label={
                    e.archived ? `استعادة ${e.name}` : `أرشفة ${e.name}`
                  }
                  onClick={() =>
                    saver.update(
                      "evoExercises",
                      e.id,
                      { archived: !e.archived },
                      e.archived ? "استُعيد التمرين." : "أُرشف التمرين.",
                    )
                  }
                >
                  <Archive size={15} />
                </button>
                <ConfirmDelete
                  compact
                  label={e.name}
                  onConfirm={() => saver.remove("evoExercises", e.id)}
                />
              </li>
            ))}
          </ul>
        </section>
        <section className="evo-panel" aria-labelledby="history-title">
          <SectionTitle
            title="السجل والمؤشرات"
            kicker="مؤشرات حسابية، لا قياس للقوة أو تكوين الجسم"
          />
          {completed.length === 0 ? (
            <Empty title="لا جلسات مكتملة بعد">
              ستظهر المؤشرات بعد جلسات حقيقية. لا رسوم وهمية.
            </Empty>
          ) : (
            <>
              <TrendChart
                title="حجم التحميل لكل جلسة (الوزن × التكرار)"
                unit="كغ"
                points={volumePoints}
              />
              {exerciseNames.length > 0 && (
                <label className="field">
                  <span>أثقل وزن مسجّل لتمرين</span>
                  <select
                    value={trendName}
                    onChange={(e) => setTrendExercise(e.target.value)}
                  >
                    {exerciseNames.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              )}
              {trendName && (
                <TrendChart
                  title={`أثقل وزن: ${trendName}`}
                  unit="كغ"
                  points={trendPoints}
                />
              )}
              <ul className="evo-timeline">
                {completed.slice(0, 10).map((w) => (
                  <li key={w.id}>
                    <time>
                      {dateLabel(w.date, undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </time>
                    <Link href={`/evolution/fitness/session/${w.id}`}>
                      {w.templateName} · {number(w.sets.length)} مجموعة ·{" "}
                      {number(volumeLoad(w.sets))} كغ
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="muted small">
            جلسات مكتملة: {number(completed.length)} · أيام راحة مسجّلة:{" "}
            {number(state.evoRestDays.length)}
          </p>
        </section>
      </div>

      <section className="evo-panel" aria-labelledby="body-title">
        <SectionTitle
          title="قياسات الجسم (اختياري)"
          kicker="خاصة؛ لا تقييم للمظهر"
          action={
            <button
              type="button"
              className="text-link"
              aria-expanded={showBody}
              onClick={() => setShowBody(!showBody)}
            >
              {showBody ? "إخفاء" : "إظهار"}
            </button>
          }
        />
        {showBody && (
          <>
            <form
              className="evo-inline-add"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await saver.create(
                    "evoMetrics",
                    {
                      type: "bodyweight",
                      value: Number(metric.value),
                      unit: metric.unit,
                      date: metric.date,
                    },
                    "حُفظ القياس.",
                  )
                )
                  setMetric({ ...metric, value: "" });
              }}
            >
              <label className="field">
                <span>وزن الجسم</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={metric.value}
                  onChange={(e) =>
                    setMetric({ ...metric, value: e.target.value })
                  }
                  required
                />
              </label>
              <label className="field">
                <span>الوحدة</span>
                <select
                  value={metric.unit}
                  onChange={(e) =>
                    setMetric({ ...metric, unit: e.target.value })
                  }
                >
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
              </label>
              <label className="field">
                <span>التاريخ</span>
                <input
                  type="date"
                  value={metric.date}
                  onChange={(e) =>
                    setMetric({ ...metric, date: e.target.value })
                  }
                />
              </label>
              <Button type="submit" variant="secondary" loading={saver.busy}>
                احفظ
              </Button>
            </form>
            <TrendChart
              title="وزن الجسم"
              unit={weights[0]?.unit || "kg"}
              points={weights
                .filter((w) => w.unit === (weights[0]?.unit || "kg"))
                .map((w) => ({ date: w.date, value: w.value }))}
            />
            <PhotoTimeline
              pillar="fitness"
              area="body"
              title="صور التقدّم الخاصة (اختيارية)"
              startDate={cycle?.startDate}
              today={today}
            />
          </>
        )}
      </section>
    </div>
  );
}
