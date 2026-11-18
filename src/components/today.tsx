"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  BookOpen,
  Castle,
  Check,
  ChevronLeft,
  Clock3,
  Flag,
  Leaf,
  Lightbulb,
  Mic,
  Plus,
  Sprout,
  Target,
} from "lucide-react";
import { useApp } from "./app-provider";
import { LearningArt, PalaceArt } from "./art";
import { Button, Modal, useToast } from "./ui";
import { dateLabel, number } from "@/lib/format";
const program = [
  {
    slug: "familiarity-is-not-recall",
    title: "الألفة ليست استدعاءً",
    subtitle: "اكتشف الفرق بنفسك",
    icon: Lightbulb,
  },
  {
    slug: "useful-self-test",
    title: "ابنِ اختبارًا مفيدًا",
    subtitle: "اسأل بطريقة تُعلّمك",
    icon: BookOpen,
  },
  {
    slug: "spaced-practice",
    title: "باعد بين مراجعاتك",
    subtitle: "عد في الوقت المناسب",
    icon: Clock3,
  },
  {
    slug: "metacognitive-calibration",
    title: "اعرف ما تعرفه",
    subtitle: "قارن توقعك بنتيجتك",
    icon: Target,
  },
];
export default function TodayPage() {
  const { state, user, create, update, savePreferences } = useApp(),
    toast = useToast();
  const [capture, setCapture] = useState<"note" | "task" | null>(null),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!state) return null;
  const completed = new Set(
    state.lessonAttempts
      .filter((a) => a.status === "completed")
      .map((a) => a.lessonSlug),
  );
  const next = program.find((l) => !completed.has(l.slug)) || program[0];
  const inProgress = state.lessonAttempts.find(
    (a) => a.lessonSlug === next.slug && a.status === "in_progress",
  );
  const due = state.reviews.filter((r) => new Date(r.dueAt) <= new Date());
  const tasks = [...state.tasks.filter((t) => !t.done)]
    .sort(
      (a, b) =>
        Number(b.priority) - Number(a.priority) || b.importance - a.importance,
    )
    .slice(0, 3);
  const lastLearningAt = [
    ...state.answers.map((a) => a.createdAt),
    ...state.reviewEvents
      .filter((e) => e.kind === "attempt")
      .map((e) => e.createdAt),
  ]
    .sort()
    .at(-1);
  const returning =
    !!lastLearningAt &&
    Date.now() - new Date(lastLearningAt).getTime() >= 3 * 86400000;
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: state.preferences.timezone,
    }).format(new Date()),
  );
  const greeting =
    hour < 12 ? "صباح الخير" : hour < 18 ? "نهارك سعيد" : "مساء الخير";
  const deadlines = state.tasks
    .filter((t) => !t.done && t.dueDate)
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
    .slice(0, 2);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (capture === "note")
        await create("notes", {
          title: text.trim().split("\n")[0].slice(0, 80),
          text: text.trim(),
          journal: false,
        });
      else
        await create("tasks", {
          title: text.trim(),
          importance: 3,
          done: false,
          priority: true,
        });
      setCapture(null);
      setText("");
      toast(capture === "note" ? "حُفظت ملاحظتك كما هي." : "أُضيفت أولويتك.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="today-page">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">
            <span className="tiny-dot" /> يوم جديد، فرصة لتعلّم يبقى
          </p>
          <h1>
            {greeting}
            {user?.name ? `، ${user.name.split(" ")[0]}` : ""}
            <span className="greeting-leaf">
              <Leaf size={29} strokeWidth={1.4} />
            </span>
          </h1>
          <p className="page-description">
            مساحتك لتتعلّم بعمق، وتختار ما يهمّك اليوم.
          </p>
        </div>
        <Link href="/study" className="btn btn-secondary study-start">
          <Clock3 size={17} /> ابدأ جلسة دراسة
        </Link>
      </div>
      {!state.preferences.onboardingDone && (
        <div className="onboarding-invite">
          <span>أول مرة هنا؟ تعرّف إلى مساحتك في ثلاث خطوات اختيارية.</span>
          <Link href="/onboarding" className="text-link">
            جولة سريعة <ArrowUpLeft size={15} />
          </Link>
          <button
            type="button"
            className="text-link"
            onClick={() =>
              savePreferences({ onboardingDone: true }).catch((e) =>
                toast(e.message),
              )
            }
          >
            ابدأ مباشرة
          </button>
        </div>
      )}
      {returning && (due.length > 0 || deadlines.length > 0) && (
        <div className="return-digest">
          <Leaf size={19} />
          <p>
            مرحبًا بعودتك. لديك {number(due.length)} مراجعات متاحة و
            {number(deadlines.length)} مواعيد مسجّلة. اختر ما تبدأ به.
          </p>
          <Link href="/reviews" className="text-link">
            اختر مراجعة <ArrowUpLeft size={15} />
          </Link>
        </div>
      )}
      <section className="learning-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="hero-label">
            <span className="hero-label-dot" /> تعلّم كيف تتعلّم
          </span>
          <h2 id="hero-title">
            تعلّم أقل عشوائية.
            <br />
            <span>وتذكّر أكثر بثقة.</span>
          </h2>
          <p>
            افهم كيف تعمل ذاكرتك، واختبر ما تعرفه فعلًا.
            <br className="desktop-only" /> رحلة تفاعلية صغيرة، وأثر يبقى معك.
          </p>
          <Link
            className="btn btn-primary hero-button"
            href={due.length ? "/reviews" : `/learn/${next.slug}`}
          >
            {due.length
              ? "حان وقت استدعاء ما تعلّمته"
              : inProgress
                ? "تابع من حيث وصلت"
                : completed.size === 4
                  ? "عد لتجربة تعلّم"
                  : "ابدأ رحلة التعلّم"}
            <ArrowLeft size={19} />
          </Link>
          <div className="hero-meta">
            <span>
              <BookOpen size={14} />{" "}
              {due.length ? `${number(due.length)} مراجعات متاحة` : next.title}
            </span>
            <i />
            <span>على خطوتك أنت</span>
          </div>
        </div>
        <div className="hero-art">
          <span className="art-corner art-corner-one">✳</span>
          <LearningArt />
          <span className="art-caption">
            <span className="tiny-dot" /> من الفهم إلى الاستدعاء
          </span>
        </div>
      </section>
      <section className="learning-path-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">مهارة تستحق أن تبدأ بها</span>
            <h2>رحلتك نحو تعلّم أفضل</h2>
          </div>
          <Link href="/learn" className="text-link">
            استكشف المسار <ArrowUpLeft size={17} />
          </Link>
        </div>
        <div className="home-lesson-path">
          {program.map((lesson, i) => {
            const done = completed.has(lesson.slug),
              current = next.slug === lesson.slug;
            const Icon = lesson.icon;
            return (
              <Link
                href={`/learn/${lesson.slug}`}
                key={lesson.slug}
                className={`home-lesson ${done ? "done" : ""} ${current ? "current" : ""}`}
              >
                <div className="home-lesson-node">
                  {done ? (
                    <Check size={20} />
                  ) : (
                    <Icon size={21} strokeWidth={1.5} />
                  )}
                </div>
                <div>
                  <span className="lesson-index">
                    الدرس {number(i + 1)}{" "}
                    {done ? "· مكتمل" : current ? "· خطوتك التالية" : ""}
                  </span>
                  <h3>{lesson.title}</h3>
                  <p>{lesson.subtitle}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <div className="today-columns">
        <section className="priorities-section">
          <div className="section-heading">
            <div>
              <h2>
                <Flag size={20} /> ما يهمّك اليوم
              </h2>
              <p className="muted">حتى ثلاث أولويات، حسب الأهمية.</p>
            </div>
            <button
              className="icon-button subtle"
              onClick={() => {
                setCapture("task");
                setError("");
              }}
              aria-label="أضف أولوية"
            >
              <Plus size={19} />
            </button>
          </div>
          <div className="priority-list">
            {tasks.length ? (
              tasks.map((t) => (
                <div className="priority-row" key={t.id}>
                  <button
                    className="task-check"
                    aria-label={`أكمل: ${t.title}`}
                    onClick={() =>
                      update("tasks", t.id, { done: true }).catch((e) =>
                        toast(e.message),
                      )
                    }
                  />
                  <div>
                    <strong>{t.title}</strong>
                    <small>
                      {t.importance === 3
                        ? "أهمية عالية"
                        : t.importance === 2
                          ? "أهمية متوسطة"
                          : "أهمية منخفضة"}
                      {t.dueDate
                        ? ` · ${dateLabel(t.dueDate, state.preferences.timezone, { day: "numeric", month: "short" })}`
                        : ""}
                    </small>
                  </div>
                  <span
                    className={`importance-dot importance-${t.importance}`}
                  />
                </div>
              ))
            ) : (
              <div className="priority-empty">
                <span>
                  <Sprout size={27} strokeWidth={1.4} />
                </span>
                <p>ما الخطوة التي ستُحدث فرقًا اليوم؟</p>
                <button
                  className="text-link"
                  onClick={() => {
                    setCapture("task");
                    setError("");
                  }}
                >
                  اختر أولويتك الأولى <Plus size={15} />
                </button>
              </div>
            )}
          </div>
          <Link href="/space/tasks" className="section-footer-link">
            كل المهام <ChevronLeft size={15} />
          </Link>
        </section>
        <section className="palace-preview">
          <div className="palace-preview-copy">
            <span className="eyebrow">
              <Castle size={15} /> قصر الذاكرة
            </span>
            <h2>
              امنح أفكارك
              <br />
              مكانًا لتبقى.
            </h2>
            <p>
              خمس محطات في قصر جاهز.
              <br />
              اربط، تخيّل، ثم استدعِ.
            </p>
            <Link href="/palace" className="text-link">
              ادخل قصرك <ArrowLeft size={17} />
            </Link>
          </div>
          <PalaceArt />
        </section>
      </div>
      <div className="today-lower">
        <section className="review-summary">
          <span className="soft-icon">
            <Clock3 size={20} />
          </span>
          <div>
            <h3>
              {due.length
                ? `${number(due.length)} مراجعات تنتظر استدعاءك`
                : "لكل معرفة موعد للعودة"}
            </h3>
            <p>
              {due.length
                ? "اختر ما تبدأ به، وعدّل المواعيد بما يناسبك."
                : state.reviews.length
                  ? "مراجعاتك القادمة محفوظة، وستجد مواعيدها هنا."
                  : "بعد درسك الأول، سنرتّب لك مراجعة لاحقة."}
            </p>
          </div>
          <Link
            href="/reviews"
            className="icon-button"
            aria-label="افتح المراجعات"
          >
            <ArrowUpLeft size={21} />
          </Link>
        </section>
        <section className="capture-bar">
          <span>فكرة في بالك؟</span>
          <button
            onClick={() => {
              setCapture("note");
              setError("");
            }}
          >
            <Plus size={17} /> دوّنها
          </button>
          <Link href="/space/voice">
            <Mic size={17} /> سجّلها
          </Link>
        </section>
      </div>
      {deadlines.length > 0 && (
        <section className="deadline-strip">
          <span>مواعيد مهمة</span>
          {deadlines.map((t) => (
            <Link key={t.id} href={`/space/tasks/${t.id}`}>
              {t.title}
              <small>
                {dateLabel(t.dueDate!, state.preferences.timezone, {
                  day: "numeric",
                  month: "short",
                })}
              </small>
            </Link>
          ))}
        </section>
      )}
      <Modal
        open={!!capture}
        onClose={() => setCapture(null)}
        title={capture === "note" ? "مساحة لفكرتك" : "ما أولويتك؟"}
      >
        <form onSubmit={save} className="stack">
          <label className="field">
            <span>
              {capture === "note"
                ? "اكتبها كما هي؛ ستبقى ملاحظة."
                : "خطوة مهمة يمكنك فعلها"}
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              required
              rows={4}
              maxLength={capture === "note" ? 20000 : 300}
              placeholder={
                capture === "note"
                  ? "فكرة، سؤال، شيء لا تريد نسيانه…"
                  : "مثلًا: أن أختبر فهمي قبل إعادة القراءة"
              }
            />
          </label>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Button loading={busy} type="submit">
            حفظ {capture === "note" ? "الملاحظة" : "الأولوية"}
            <Check size={17} />
          </Button>
        </form>
      </Modal>
    </div>
  );
}
