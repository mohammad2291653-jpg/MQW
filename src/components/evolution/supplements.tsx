"use client";
import { useState } from "react";
import {
  Plus,
  Pill,
  Check,
  SkipForward,
  CalendarClock,
  Ban,
  History,
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
} from "./shared";
import { slotsForDay, adherence, STATUS_LABELS } from "./derive";
import {
  addDays,
  describeSchedule,
  upcomingDays,
  WEEKDAY_LABELS,
  isDay,
  type Schedule,
} from "@/lib/evolution";
import { dateLabel, number } from "@/lib/format";
import type { EvoSupplement } from "@/lib/types";
import { Button, Modal } from "../ui";

const INTAKE_ACTIONS = [
  { value: "taken", label: "أخذته", icon: Check },
  { value: "skipped", label: "تخطّيت", icon: SkipForward },
  { value: "postponed", label: "أجّلت", icon: CalendarClock },
  { value: "not_applicable", label: "لا ينطبق", icon: Ban },
] as const;

function SupplementForm({
  item,
  today,
  onDone,
}: {
  item?: EvoSupplement;
  today: string;
  onDone: () => void;
}) {
  const saver = useSaver();
  const [v, setV] = useState({
    kind: item?.kind || "supplement",
    name: item?.name || "",
    brand: item?.brand || "",
    purpose: item?.purpose || "",
    ingredient: item?.ingredient || "",
    strength: item?.strength || "",
    doseText: item?.doseText || "",
    sourceNote: item?.sourceNote || "",
    contraindicationNote: item?.contraindicationNote || "",
    professionalAdvice: item?.professionalAdvice || "",
    status: item?.status || "active",
    startDate: item?.startDate || today,
    endDate: item?.endDate || "",
  });
  const [schedule, setSchedule] = useState<Schedule>(
    item?.schedule || { kind: "daily", times: [] },
  );
  const set =
    (k: keyof typeof v) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setV({ ...v, [k]: e.target.value });
  const times = schedule.times || [];
  const preview = isDay(v.startDate)
    ? upcomingDays(
        schedule,
        v.startDate,
        v.startDate > today ? v.startDate : today,
        5,
        v.endDate || null,
      )
    : [];
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const payload = {
          ...v,
          endDate: v.endDate || null,
          schedule: { ...schedule, times: times.filter(Boolean) },
        };
        const ok = item
          ? await saver.update(
              "evoSupplements",
              item.id,
              payload,
              "حُفظ التعديل؛ السجل السابق محفوظ كما هو.",
            )
          : await saver.create("evoSupplements", payload, "أُضيف إلى قائمتك.");
        if (ok) onDone();
      }}
    >
      <div className="evo-grid-2">
        <label className="field">
          <span>الاسم</span>
          <input
            value={v.name}
            onChange={set("name")}
            required
            maxLength={200}
          />
        </label>
        <label className="field">
          <span>النوع</span>
          <select value={v.kind} onChange={set("kind")}>
            <option value="supplement">مكمّل</option>
            <option value="medication">دواء (للنقاش مع مختص)</option>
          </select>
        </label>
        <label className="field">
          <span>المادة الفعالة</span>
          <input
            value={v.ingredient}
            onChange={set("ingredient")}
            maxLength={1000}
          />
        </label>
        <label className="field">
          <span>التركيز لكل وحدة (كما على العبوة)</span>
          <input
            value={v.strength}
            onChange={set("strength")}
            maxLength={100}
            placeholder="من العبوة؛ لا قيمة افتراضية"
          />
        </label>
        <label className="field">
          <span>الكمية التي حددتها أنت أو مختصك</span>
          <input
            value={v.doseText}
            onChange={set("doseText")}
            maxLength={200}
            placeholder="اكتبها كما هي؛ لا نقترح جرعة"
          />
        </label>
        <label className="field">
          <span>مصدر التعليمات</span>
          <input
            value={v.sourceNote}
            onChange={set("sourceNote")}
            maxLength={1000}
            placeholder="الملصق، الصيدلي، الطبيب…"
          />
        </label>
      </div>
      <fieldset className="evo-fieldset">
        <legend>التكرار</legend>
        <select
          aria-label="نوع التكرار"
          value={schedule.kind}
          onChange={(e) => {
            const kind = e.target.value as Schedule["kind"];
            setSchedule(
              kind === "weekdays"
                ? { kind, weekdays: [], times }
                : kind === "interval"
                  ? { kind, every: 2, times }
                  : { kind, times },
            );
          }}
        >
          <option value="daily">يوميًا</option>
          <option value="weekdays">أيام محددة من الأسبوع</option>
          <option value="interval">كل عدد من الأيام</option>
          <option value="as_needed">عند الحاجة (دون جدول)</option>
        </select>
        {schedule.kind === "weekdays" && (
          <div className="evo-chips" role="group" aria-label="أيام الأسبوع">
            {[6, 0, 1, 2, 3, 4, 5].map((d) => {
              const on = schedule.weekdays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={`evo-chip ${on ? "on" : ""}`}
                  aria-pressed={on}
                  onClick={() =>
                    setSchedule({
                      ...schedule,
                      weekdays: on
                        ? schedule.weekdays.filter((x) => x !== d)
                        : [...schedule.weekdays, d],
                    })
                  }
                >
                  {WEEKDAY_LABELS[d]}
                </button>
              );
            })}
          </div>
        )}
        {schedule.kind === "interval" && (
          <label className="field">
            <span>كل كم يوم؟</span>
            <input
              type="number"
              min={2}
              max={60}
              value={schedule.every}
              onChange={(e) =>
                setSchedule({ ...schedule, every: Number(e.target.value) })
              }
            />
          </label>
        )}
        <div className="evo-times">
          {times.map((t, i) => (
            <span key={i} className="evo-time">
              <input
                type="time"
                aria-label={`الوقت ${i + 1}`}
                value={t}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    times: times.map((x, j) => (j === i ? e.target.value : x)),
                  })
                }
              />
              <button
                type="button"
                className="evo-icon-btn"
                aria-label="إزالة الوقت"
                onClick={() =>
                  setSchedule({
                    ...schedule,
                    times: times.filter((_, j) => j !== i),
                  })
                }
              >
                ×
              </button>
            </span>
          ))}
          {times.length < 6 && schedule.kind !== "as_needed" && (
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setSchedule({ ...schedule, times: [...times, ""] })
              }
            >
              <Plus size={14} /> وقت محدد (اختياري)
            </button>
          )}
        </div>
        {preview.length > 0 && (
          <p className="muted small">
            المواعيد القادمة:{" "}
            {preview
              .map((d) =>
                dateLabel(d, undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                }),
              )
              .join("، ")}
          </p>
        )}
        {item && (
          <p className="muted small">
            تغيير الجدول ينشئ نسخة جديدة تبدأ من اليوم؛ السجلات السابقة لا
            تتغير.
          </p>
        )}
      </fieldset>
      <div className="evo-grid-3">
        <label className="field">
          <span>تاريخ البدء</span>
          <input
            type="date"
            value={v.startDate}
            onChange={set("startDate")}
            required
          />
        </label>
        <label className="field">
          <span>تاريخ الانتهاء (اختياري)</span>
          <input type="date" value={v.endDate} onChange={set("endDate")} />
        </label>
        <label className="field">
          <span>الحالة</span>
          <select value={v.status} onChange={set("status")}>
            <option value="active">نشط</option>
            <option value="paused">متوقف مؤقتًا</option>
            <option value="discontinued">أوقفته</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>الغرض أو ملاحظاتك</span>
        <input value={v.purpose} onChange={set("purpose")} maxLength={1000} />
      </label>
      <label className="field">
        <span>موانع أو تحذيرات قرأتها</span>
        <textarea
          rows={2}
          value={v.contraindicationNote}
          onChange={set("contraindicationNote")}
          maxLength={2000}
        />
      </label>
      <label className="field">
        <span>ما قاله الصيدلي أو الطبيب</span>
        <textarea
          rows={2}
          value={v.professionalAdvice}
          onChange={set("professionalAdvice")}
          maxLength={3000}
        />
      </label>
      <FormError error={saver.error} />
      <Button type="submit" loading={saver.busy}>
        {item ? "احفظ التعديل" : "أضف"}
      </Button>
    </form>
  );
}

export default function SupplementsPage() {
  const { state, today, enabled } = useEvolution();
  const saver = useSaver();
  const [modal, setModal] = useState<EvoSupplement | "new" | null>(null);
  if (!enabled("supplements")) return <PillarOff label="المكمّلات" />;
  const slots = slotsForDay(state, today);
  const week = adherence(state, addDays(today, -6), today);
  const supplements = state.evoSupplements.filter(
    (s) => s.kind === "supplement",
  );
  const medications = state.evoSupplements.filter(
    (s) => s.kind === "medication",
  );
  const history = [...state.evoIntakes]
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
    )
    .slice(0, 20);
  const name = (id: string) =>
    state.evoSupplements.find((s) => s.id === id)?.name || "عنصر محذوف";
  const record = (s: (typeof slots)[number], status: string) =>
    saver.create(
      "evoIntakes",
      { supplementId: s.supplement.id, date: today, time: s.time, status },
      `سُجّل: ${STATUS_LABELS[status]}.`,
    );

  return (
    <div className="evo-pillar-page">
      <div className="evo-pillar-intro">
        <div>
          <h2>مدير المكمّلات</h2>
          <p className="muted">
            قائمة تكتبها أنت، وجدول مرن، وسجل فعلي لما أخذته أو تخطيته.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModal("new")}
        >
          <Plus size={16} /> أضف عنصرًا
        </button>
      </div>
      <Boundary title="لا جرعات مقترحة">
        لا يقترح التطبيق جرعات أو مكمّلات ولا يستنتج نقصًا. التداخلات بين المكمّلات
        والأدوية ممكنة؛ راجعها مع صيدلي أو طبيب. التنبيهات تعمل فقط والتطبيق
        مفتوح، ولا توجد إشعارات خلفية.
      </Boundary>
      <div className="evo-two-col">
        <section className="evo-panel" aria-labelledby="sup-today">
          <SectionTitle title="اليوم" kicker="المواعيد المخطّطة" />
          {slots.length === 0 ? (
            <Empty title="لا شيء مُجدول اليوم" />
          ) : (
            <ul className="evo-dose-list">
              {slots.map((s) => (
                <li key={`${s.supplement.id}-${s.time}`}>
                  <div>
                    <strong>{s.supplement.name}</strong>
                    <small>
                      {[
                        s.time && `الساعة ${s.time}`,
                        s.supplement.doseText &&
                          `كما حددت: ${s.supplement.doseText}`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "دون وقت محدد"}
                    </small>
                  </div>
                  <div
                    className="evo-status-row"
                    role="group"
                    aria-label={`حالة ${s.supplement.name}`}
                  >
                    {INTAKE_ACTIONS.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        className={`evo-status ${s.intake?.status === a.value ? "on" : ""}`}
                        aria-pressed={s.intake?.status === a.value}
                        disabled={saver.busy}
                        onClick={() => record(s, a.value)}
                      >
                        <a.icon size={14} aria-hidden="true" /> {a.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <FormError error={saver.error} />
        </section>
        <section className="evo-panel" aria-labelledby="sup-week">
          <SectionTitle title="آخر ٧ أيام" kicker="أعداد فعلية مع المقام" />
          {week.planned === 0 ? (
            <Empty title="لا مواعيد مخطّطة في هذه الفترة" />
          ) : (
            <dl className="evo-facts">
              <div>
                <dt>أُخذ</dt>
                <dd>
                  {number(week.taken)}{" "}
                  <small>من {number(week.planned)} موعدًا مخطّطًا</small>
                </dd>
              </div>
              <div>
                <dt>تخطٍّ</dt>
                <dd>{number(week.skipped)}</dd>
              </div>
              <div>
                <dt>مؤجّل</dt>
                <dd>{number(week.postponed)}</dd>
              </div>
              <div>
                <dt>بلا تسجيل</dt>
                <dd>
                  {number(
                    week.planned - week.taken - week.skipped - week.postponed,
                  )}
                </dd>
              </div>
            </dl>
          )}
          <p className="muted small">
            الالتزام بالجدول لا يعني أن العنصر ضروري أو فعال أو آمن لك.
          </p>
        </section>
      </div>
      {[
        ["قائمة المكمّلات", supplements],
        ["أدوية للنقاش مع مختص", medications],
      ].map(([title, list]) => (
        <section className="evo-panel" key={title as string}>
          <SectionTitle title={title as string} />
          {(list as EvoSupplement[]).length === 0 ? (
            <Empty title="لا عناصر بعد" />
          ) : (
            <ul className="evo-list">
              {(list as EvoSupplement[]).map((s) => (
                <li key={s.id} className={s.status !== "active" ? "dim" : ""}>
                  <Pill size={18} aria-hidden="true" />
                  <div>
                    <strong>{s.name}</strong>
                    <small>
                      {[
                        describeSchedule(s.schedule),
                        s.strength && `على العبوة: ${s.strength}`,
                        s.status === "active"
                          ? ""
                          : s.status === "paused"
                            ? "متوقف مؤقتًا"
                            : "أوقفته",
                        s.scheduleHistory.length > 1 &&
                          `${number(s.scheduleHistory.length)} نسخ جدول`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setModal(s)}
                  >
                    تعديل
                  </button>
                  <ConfirmDelete
                    compact
                    label={s.name}
                    onConfirm={() =>
                      saver.remove("evoSupplements", s.id, "حُذف العنصر وسجله.")
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <section className="evo-panel" aria-labelledby="sup-history">
        <SectionTitle
          title="السجل"
          kicker={
            <>
              <History size={13} aria-hidden="true" /> آخر الأحداث
            </>
          }
        />
        {history.length === 0 ? (
          <Empty title="لا سجل بعد" />
        ) : (
          <ul className="evo-timeline">
            {history.map((i) => (
              <li key={i.id}>
                <time>
                  {dateLabel(i.date, undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </time>
                <span>
                  {name(i.supplementId)}{" "}
                  {i.time && <small dir="ltr">{i.time}</small>} ·{" "}
                  <span className={`evo-state ${i.status}`}>
                    {STATUS_LABELS[i.status]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === "new" ? "عنصر جديد" : "تعديل العنصر"}
      >
        {modal && (
          <SupplementForm
            item={modal === "new" ? undefined : modal}
            today={today}
            onDone={() => setModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
