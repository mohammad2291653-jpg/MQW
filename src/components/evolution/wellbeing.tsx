"use client";
import { useEffect, useState } from "react";
import { EyeOff, Eye, Lock, Wind, HeartHandshake } from "lucide-react";
import {
  useEvolution,
  useSaver,
  SectionTitle,
  Boundary,
  FormError,
  ConfirmDelete,
  Empty,
  Scale,
} from "./shared";
import { dateLabel } from "@/lib/format";
import type { EvoJournal } from "@/lib/types";
import { Button } from "../ui";

const PROMPTS: Record<EvoJournal["prompt"], { label: string; hint: string }> = {
  free: { label: "كتابة حرة", hint: "اكتب ما تريد، دون ترتيب." },
  emotions: {
    label: "مشاعري",
    hint: "ما الشعور الأوضح اليوم؟ وما الذي ساهم فيه؟",
  },
  boundaries: { label: "حدودي", hint: "أين احتجت أن تقول لا، أو نعم، اليوم؟" },
  relationships: {
    label: "علاقاتي",
    hint: "لحظة تواصل أو توتر تريد التفكير فيها.",
  },
  gratitude: { label: "مصادر الراحة", hint: "شيء صغير خفّف عنك اليوم." },
};

function Breathing() {
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const phases = ["شهيق", "احبس", "زفير", "احبس"];
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setStep((s) => s + 1), 4000);
    return () => clearInterval(t);
  }, [running]);
  return (
    <section className="evo-panel evo-breath" aria-labelledby="breath-title">
      <SectionTitle title="تنفّس هادئ" kicker="معلومة اختيارية، ليست علاجًا" />
      <p className="muted small">
        تمرين تنفّس مربّع: أربع ثوانٍ لكل مرحلة. توقف في أي وقت.
      </p>
      <div
        className={`evo-breath-orb ${running ? `phase-${step % 4}` : ""}`}
        aria-hidden="true"
      />
      <p className="evo-breath-label" aria-live="polite">
        {running ? phases[step % 4] : "جاهز حين تكون جاهزًا"}
      </p>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setRunning(!running);
          setStep(0);
        }}
      >
        <Wind size={16} /> {running ? "توقّف" : "ابدأ"}
      </button>
    </section>
  );
}

export default function WellbeingPage() {
  const { state, cycle, today, enabled } = useEvolution();
  const saver = useSaver();
  const existing = state.evoWellbeing.find((w) => w.date === today);
  const [check, setCheck] = useState({
    mood: existing?.mood ?? null,
    stress: existing?.stress ?? null,
    energy: existing?.energy ?? null,
    note: existing?.note || "",
  });
  const [entry, setEntry] = useState({
    prompt: "free" as EvoJournal["prompt"],
    body: "",
  });
  const [revealed, setRevealed] = useState<string[]>([]);
  const [editing, setEditing] = useState<EvoJournal | null>(null);

  if (!enabled("wellbeing"))
    return (
      <div className="evo-optin">
        <HeartHandshake size={40} strokeWidth={1.2} aria-hidden="true" />
        <h2>الرفاه النفسي والعاطفي</h2>
        <p>
          قسم اختياري تمامًا ومغلق افتراضيًا: تسجيل ذاتي للمزاج والتوتر والطاقة،
          ويوميات خاصة، وتمرين تنفّس. ليس علاجًا نفسيًا ولا تشخيصًا، ولا يُستنتج منه
          أي تصنيف.
        </p>
        <ul className="evo-privacy-list">
          <li>لا معاينة لهذا القسم في الصفحة الرئيسية أو البحث.</li>
          <li>لا يُرسل شيء إلى AI، ولا تحليل تلقائي للمشاعر.</li>
          <li>يمكنك حذف أي إدخال أو حذف القسم كاملًا.</li>
        </ul>
        {cycle && (
          <Button
            loading={saver.busy}
            onClick={() =>
              saver.update(
                "evoCycles",
                cycle.id,
                { pillars: { ...cycle.pillars, wellbeing: true } },
                "فُعّل قسم الرفاه.",
              )
            }
          >
            فعّل القسم لنفسي
          </Button>
        )}
        <FormError error={saver.error} />
      </div>
    );

  const journal = [...state.evoJournal].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
  return (
    <div className="evo-pillar-page">
      <div className="evo-pillar-intro">
        <div>
          <h2>الرفاه النفسي والعاطفي</h2>
          <p className="muted">
            <Lock size={13} aria-hidden="true" /> خاص بك. سجّل ما تريد فقط، ولا
            بأس بتخطي أي يوم.
          </p>
        </div>
      </div>
      <Boundary tone="care" title="لست وحدك">
        هذا القسم للتأمل الذاتي، وليس دعمًا طارئًا أو علاجًا. إذا كنت في خطر أو
        تفكر في إيذاء نفسك، تواصل فورًا مع خدمات الطوارئ المحلية أو شخص تثق به أو
        مختص مؤهل.
      </Boundary>
      <div className="evo-two-col">
        <section className="evo-panel stack" aria-labelledby="checkin-title">
          <SectionTitle title="تسجيل اليوم" kicker="اختياري بالكامل" />
          <Scale
            label="المزاج"
            value={check.mood}
            onChange={(v) => setCheck({ ...check, mood: v })}
            low="منخفض"
            high="جيد"
          />
          <Scale
            label="التوتر"
            value={check.stress}
            onChange={(v) => setCheck({ ...check, stress: v })}
            low="هادئ"
            high="مرتفع"
          />
          <Scale
            label="الطاقة"
            value={check.energy}
            onChange={(v) => setCheck({ ...check, energy: v })}
            low="منهك"
            high="نشيط"
          />
          <label className="field">
            <span>كلمة أو جملة (اختياري)</span>
            <input
              value={check.note}
              maxLength={5000}
              onChange={(e) => setCheck({ ...check, note: e.target.value })}
            />
          </label>
          <FormError error={saver.error} />
          <div className="evo-actions">
            <Button
              loading={saver.busy}
              onClick={() =>
                saver.create(
                  "evoWellbeing",
                  { date: today, ...check },
                  existing ? "حُدّث تسجيل اليوم." : "حُفظ تسجيلك.",
                )
              }
            >
              احفظ
            </Button>
            {existing && (
              <ConfirmDelete
                label="تسجيل اليوم"
                onConfirm={() => saver.remove("evoWellbeing", existing.id)}
              />
            )}
          </div>
          <p className="muted small">
            لا يُحسب مزاجك من أي نشاط آخر في التطبيق، ولا تُعرض رسوم مزاج هنا.
          </p>
        </section>
        <Breathing />
      </div>
      <section className="evo-panel" aria-labelledby="journal-title">
        <SectionTitle
          title="يوميات خاصة"
          kicker="مخفية في القائمة حتى تفتحها"
        />
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = editing
              ? await saver.update(
                  "evoJournal",
                  editing.id,
                  { prompt: entry.prompt, body: entry.body },
                  "حُفظ التعديل.",
                )
              : await saver.create(
                  "evoJournal",
                  { date: today, ...entry },
                  "حُفظت اليومية.",
                );
            if (ok) {
              setEntry({ prompt: "free", body: "" });
              setEditing(null);
            }
          }}
        >
          <div className="evo-chips" role="radiogroup" aria-label="نوع التأمل">
            {(Object.keys(PROMPTS) as EvoJournal["prompt"][]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={entry.prompt === k}
                className={`evo-chip ${entry.prompt === k ? "on" : ""}`}
                onClick={() => setEntry({ ...entry, prompt: k })}
              >
                {PROMPTS[k].label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>{PROMPTS[entry.prompt].hint}</span>
            <textarea
              rows={5}
              value={entry.body}
              maxLength={50000}
              onChange={(e) => setEntry({ ...entry, body: e.target.value })}
              required
            />
          </label>
          <div className="evo-actions">
            <Button type="submit" loading={saver.busy}>
              {editing ? "احفظ التعديل" : "احفظ"}
            </Button>
            {editing && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditing(null);
                  setEntry({ prompt: "free", body: "" });
                }}
              >
                إلغاء
              </button>
            )}
          </div>
        </form>
        {journal.length === 0 ? (
          <Empty title="لا يوميات بعد" />
        ) : (
          <ul className="evo-journal">
            {journal.map((j) => {
              const open = revealed.includes(j.id);
              return (
                <li key={j.id}>
                  <div className="evo-journal-head">
                    <strong>{PROMPTS[j.prompt].label}</strong>
                    <small>{dateLabel(j.date)}</small>
                    <button
                      type="button"
                      className="evo-icon-btn"
                      aria-expanded={open}
                      aria-label={open ? "إخفاء النص" : "إظهار النص"}
                      onClick={() =>
                        setRevealed(
                          open
                            ? revealed.filter((x) => x !== j.id)
                            : [...revealed, j.id],
                        )
                      }
                    >
                      {open ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        setEditing(j);
                        setEntry({ prompt: j.prompt, body: j.body });
                      }}
                    >
                      تعديل
                    </button>
                    <ConfirmDelete
                      compact
                      label="اليومية"
                      onConfirm={() => saver.remove("evoJournal", j.id)}
                    />
                  </div>
                  {open ? (
                    <p className="evo-journal-body">{j.body}</p>
                  ) : (
                    <p className="evo-masked" aria-label="نص مخفي">
                      •••••• ••••• ••••••••
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
