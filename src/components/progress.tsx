"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpLeft,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ClipboardList,
  EyeOff,
  Flag,
  Info,
  Leaf,
  ListFilter,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useApp } from "./app-provider";
import { Button, EmptyState, Modal, PageHeader, useToast } from "./ui";
import { deriveInsights } from "@/lib/insights";
import { dateLabel, number } from "@/lib/format";
export default function ProgressPage({ section = [] }: { section?: string[] }) {
  const { state, create, savePreferences } = useApp(),
    toast = useToast();
  const [period, setPeriod] = useState("30"),
    [evidence, setEvidence] = useState<string | null>(null),
    [weekly, setWeekly] = useState(section.includes("weekly-review")),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!state) return null;
  const cutoff =
    period === "all"
      ? ""
      : new Date(Date.now() - Number(period) * 86400000).toISOString();
  const answers = state.answers.filter((a) => a.createdAt >= cutoff),
    graded = answers.filter(
      (a) =>
        a.gradingSource === "deterministic" && typeof a.correct === "boolean",
    ),
    correct = graded.filter((a) => a.correct).length;
  const completed = new Set(
    state.lessonAttempts
      .filter((a) => a.status === "completed")
      .map((a) => a.lessonSlug),
  );
  const reviewEvents = state.reviewEvents.filter(
    (e) => e.kind === "attempt" && e.rating && e.createdAt >= cutoff,
  );
  const insights = deriveInsights(state);
  const selected = insights.find((i) => i.id === evidence);
  async function feedback(ruleId: string, action: "dismiss" | "inaccurate") {
    try {
      await create("insightFeedback", { ruleId, action });
      toast(
        action === "inaccurate"
          ? "حُفظ اعتراضك وأُخفيت الملاحظة."
          : "أُخفيت الملاحظة.",
      );
    } catch (e) {
      toast((e as Error).message);
    }
  }
  async function saveWeekly(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await create("weeklyReviews", {
        win: f.get("win"),
        obstacle: f.get("obstacle"),
        experiment: f.get("experiment"),
      });
      setWeekly(false);
      toast("حُفظت مراجعتك، دون تحليل نصها.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="progress-page">
      <PageHeader
        eyebrow="أدلة صغيرة، فهم أعمق"
        title="تقدّمك، كما هو."
        description="ما جرّبته فعلًا. وما يمكن أن تتعلّمه من نتائجك."
      >
        <button className="btn btn-secondary" onClick={() => setWeekly(true)}>
          <ClipboardList size={17} /> مراجعة أسبوعية
        </button>
      </PageHeader>
      <div className="progress-toolbar">
        <div className="segmented" aria-label="الفترة الزمنية">
          {[
            ["7", "هذا الأسبوع"],
            ["30", "آخر 30 يومًا"],
            ["all", "كل الوقت"],
          ].map(([v, t]) => (
            <button
              key={v}
              className={period === v ? "active" : ""}
              onClick={() => setPeriod(v)}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="muted period-caption">
          الأرقام من سجلك المحفوظ فقط
        </span>
      </div>
      <div className="progress-overview">
        <div className="progress-intro">
          <span className="soft-icon">
            <ChartNoAxesCombined size={25} />
          </span>
          <h2>
            {answers.length ? "كل محاولة تضيف وضوحًا." : "تقدّمك يبدأ بمحاولة."}
          </h2>
          <p>
            {answers.length
              ? "نتائجك تساعدك على اختيار تجربة التعلّم التالية."
              : "ابدأ باختبار قصير، ثم عُد لترى ما حدث فعلًا."}
          </p>
          {!answers.length && (
            <Link className="text-link" href="/learn">
              ابدأ أول درس <ArrowUpLeft size={16} />
            </Link>
          )}
        </div>
        <div className="metric">
          <span>دروس أكملتها</span>
          <strong>
            {number(completed.size)}
            <small> / ٤</small>
          </strong>
          <p>اكتمال الدرس لا يعني إتقان المحتوى.</p>
        </div>
        <div className="metric">
          <span>إجابات صحيحة بالقواعد</span>
          <strong>
            {graded.length ? number(correct) : "—"}
            <small>{graded.length ? ` / ${number(graded.length)}` : ""}</small>
          </strong>
          <p>
            {graded.length
              ? "للأسئلة المصححة ضمن الفترة."
              : "ستظهر بعد إجابتك عن سؤال مصحّح."}
          </p>
        </div>
        <div className="metric">
          <span>مراجعات قيّمتها</span>
          <strong>{number(reviewEvents.length)}</strong>
          <p>منفصلة عن الإجابات المصححة آليًا.</p>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <span className="section-kicker">فهم شخصي، بحدود واضحة</span>
          <h2>ما تخبرنا به تجربتك</h2>
        </div>
        <Link className="text-link" href="/settings/privacy">
          تحكّم بالتخصيص <ArrowUpLeft size={16} />
        </Link>
      </div>
      {!state.preferences.personalization ? (
        <div className="notice-panel">
          <ShieldCheck size={22} />
          <div>
            <h3>الاستنتاجات الشخصية متوقفة</h3>
            <p>
              يبقى سجل تعلمك ومراجعاتك متاحًا. يمكنك تفعيل الملاحظات الاختيارية
              من إعدادات الخصوصية.
            </p>
          </div>
        </div>
      ) : insights.length ? (
        <div className="insight-list">
          {insights.map((i) => (
            <article key={i.id} className="insight-panel">
              <div className="insight-heading">
                <span className="pill">ملاحظة مرصودة</span>
                <span className="muted">آخر 30 يومًا · القاعدة {i.id}</span>
              </div>
              <h3>{i.title}</h3>
              <p>{i.observation}</p>
              <p className="insight-caveat">
                <Info size={16} />
                {i.caveat}
              </p>
              <div className="insight-action">
                <LightbulbIcon />
                {i.action}
              </div>
              <div className="insight-controls">
                <button onClick={() => setEvidence(i.id)}>
                  اعرض الأدلة <ArrowUpLeft size={14} />
                </button>
                <button onClick={() => feedback(i.id, "inaccurate")}>
                  هذا لا يمثلني
                </button>
                <button
                  onClick={() => feedback(i.id, "dismiss")}
                  aria-label="إخفاء الملاحظة"
                >
                  <EyeOff size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="insights-empty">
          <div className="insights-empty-art">
            <span />
            <span />
            <span />
            <Sparkles size={27} />
          </div>
          <h3>ما زلنا نتعرّف إلى نتائجك</h3>
          <p>
            بعد محاولات حقيقية ستظهر ملاحظات موثّقة هنا.
            <br />
            لن نملأ الفراغ باستنتاجات عنك.
          </p>
          <Link href="/learn" className="btn btn-secondary">
            جرّب درسًا تفاعليًا <ArrowUpLeft size={17} />
          </Link>
        </div>
      )}
      <div className="progress-two-col">
        <section>
          <div className="section-heading">
            <h2>سجل التعلّم</h2>
            <span className="pill">{number(answers.length)} إجابة</span>
          </div>
          {answers.length ? (
            <div className="history-list">
              {[...answers]
                .reverse()
                .slice(0, 15)
                .map((a) => (
                  <div className="history-row" key={a.id}>
                    <span
                      className={`history-icon ${a.correct ? "positive" : ""}`}
                    >
                      {a.correct ? <Check size={17} /> : <BookOpen size={17} />}
                    </span>
                    <div>
                      <strong>
                        {a.gradingSource === "self_report"
                          ? "إجابة بتقييم ذاتي"
                          : a.gradingSource === "deterministic"
                            ? a.correct
                              ? "إجابة صحيحة"
                              : "محاولة مع تفسير"
                            : "إجابة دون تقييم"}
                      </strong>
                      <small>
                        {dateLabel(a.createdAt, state.preferences.timezone, {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                    <span className="pill">
                      {a.gradingSource === "self_report"
                        ? "ذاتي"
                        : a.gradingSource === "deterministic"
                          ? "بالقواعد"
                          : "غير مقيّم"}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="inline-empty">
              <BookOpen size={25} />
              <p>لا توجد إجابات محفوظة في هذه الفترة.</p>
            </div>
          )}
        </section>
        <aside className="weekly-card">
          <span className="eyebrow">
            <Leaf size={16} /> خمس دقائق لنفسك
          </span>
          <h2>
            توقّف قليلًا.
            <br />
            وانظر إلى ما تعلمته.
          </h2>
          <p>شيء سار جيدًا، عقبة واجهتها، وتجربة صغيرة للأسبوع المقبل.</p>
          <button className="text-link" onClick={() => setWeekly(true)}>
            ابدأ مراجعتك الأسبوعية <ArrowLeftIcon />
          </button>
          <small>اختيارية تمامًا. نصها لا يدخل في الاستنتاجات.</small>
        </aside>
      </div>
      {state.weeklyReviews.length > 0 && (
        <section className="weekly-history">
          <div className="section-heading">
            <h2>مراجعاتك الأسبوعية</h2>
          </div>
          {[...state.weeklyReviews]
            .reverse()
            .slice(0, 3)
            .map((w) => (
              <details key={w.id}>
                <summary>
                  {dateLabel(w.createdAt, state.preferences.timezone)}
                </summary>
                <p>
                  <strong>ما سار جيدًا:</strong> {w.win || "لم تُضف نصًا"}
                </p>
                <p>
                  <strong>العقبة:</strong> {w.obstacle || "لم تُضف نصًا"}
                </p>
                <p>
                  <strong>تجربتي التالية:</strong>{" "}
                  {w.experiment || "لم تُضف نصًا"}
                </p>
              </details>
            ))}
        </section>
      )}
      <Modal
        open={!!evidence}
        onClose={() => setEvidence(null)}
        title="أدلة هذه الملاحظة"
      >
        {selected && (
          <div className="stack">
            <p>{selected.observation}</p>
            <p className="muted">
              من {dateLabel(selected.from, state.preferences.timezone)} إلى{" "}
              {dateLabel(selected.to, state.preferences.timezone)}. البسط{" "}
              {selected.numerator}، المقام {selected.denominator}.
            </p>
            <p>{selected.caveat}</p>
            <ul className="evidence-list">
              {selected.sources.map((id) => {
                const a = state.answers.find((x) => x.id === id),
                  r = state.reviewEvents.find((x) => x.id === id);
                return (
                  <li key={id}>
                    <code>{id.slice(0, 12)}</code>
                    <span>
                      {dateLabel(
                        (a || r)!.createdAt,
                        state.preferences.timezone,
                        {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                    {a && (
                      <span>
                        {a.correct ? "صحيحة" : "غير صحيحة"} · {a.questionId}
                      </span>
                    )}
                    {r && (
                      <span>
                        تقييم ذاتي:{" "}
                        {r.rating === "good"
                          ? "تذكرت"
                          : r.rating === "hard"
                            ? "بصعوبة"
                            : "لم أتذكر"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Modal>
      <Modal
        open={weekly}
        onClose={() => setWeekly(false)}
        title="مراجعة أسبوعية هادئة"
      >
        <form className="stack" onSubmit={saveWeekly}>
          <p className="muted">
            أنجزت {completed.size} من أربعة دروس. سجّلت {reviewEvents.length}{" "}
            مراجعات في الفترة المختارة. اختر ما تريد الاحتفاظ به من تجربتك.
          </p>
          {[
            ["win", "شيء سار جيدًا", "خطوة صغيرة تستحق أن تتذكرها…"],
            ["obstacle", "ما الذي صعّب التعلّم؟", "اكتب إن أحببت، دون أحكام…"],
            [
              "experiment",
              "تجربة صغيرة للأسبوع القادم",
              "ما الشيء الواحد الذي تريد تجربته؟",
            ],
          ].map(([name, label, placeholder]) => (
            <label className="field" key={name}>
              <span>{label}</span>
              <textarea
                name={name}
                rows={2}
                placeholder={placeholder}
                maxLength={3000}
              />
            </label>
          ))}
          <p className="privacy-caption">
            <ShieldCheck size={13} /> النصوص خاصة ولا تُستخدم للتحليل أو AI.
          </p>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={busy}>
            احفظ مراجعتي
          </Button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setWeekly(false)}
          >
            تخطي الآن
          </button>
        </form>
      </Modal>
    </div>
  );
}
function LightbulbIcon() {
  return <Sparkles size={17} />;
}
function ArrowLeftIcon() {
  return <ArrowUpLeft size={17} />;
}
