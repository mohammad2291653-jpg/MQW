"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Map,
  RotateCcw,
} from "lucide-react";
import type { Rating, ReviewCard, ReviewEvent } from "@/lib/types";
import { getLesson } from "@/lib/lessons";
import { useApp } from "@/components/app-provider";
import { Modal } from "@/components/ui";

function displayDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
function localValue(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
function localToUtc(value: string, timezone: string) {
  const target = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(target)) throw new Error("اختر موعدًا صالحًا.");
  let guess = target;
  for (let count = 0; count < 4; count++) {
    const represented = Date.parse(
      `${localValue(new Date(guess), timezone)}:00Z`,
    );
    const delta = target - represented;
    guess += delta;
    if (!delta) break;
  }
  if (localValue(new Date(guess), timezone) !== value)
    throw new Error(
      "هذا الوقت غير متاح بسبب تغيير التوقيت الصيفي. اختر وقتًا آخر.",
    );
  return new Date(guess).toISOString();
}
export default function ReviewsPage() {
  const { state, action } = useApp();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [event, setEvent] = useState<ReviewEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const timezone = state?.preferences.timezone ?? "Asia/Hebron";
  const cards = [...(state?.reviews ?? [])].sort((a, b) =>
    a.dueAt.localeCompare(b.dueAt),
  );
  const active = cards.find((card) => card.id === activeId);
  const due = cards.filter(
    (card) => new Date(card.dueAt).getTime() <= Date.now(),
  );
  const future = cards.filter(
    (card) => new Date(card.dueAt).getTime() > Date.now(),
  );
  useEffect(() => {
    setResponse("");
    setEvent(null);
    setSubmissionId(crypto.randomUUID());
    setError("");
  }, [activeId]);
  const savedEvent = active
    ? [...(state?.reviewEvents ?? [])]
        .reverse()
        .find(
          (item) =>
            item.cardId === active.id &&
            item.kind === "attempt" &&
            !item.rating,
        )
    : undefined;
  const revealed = event ?? savedEvent;
  async function perform(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ. حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  }
  const submit = () =>
    perform(async () => {
      if (!active) return;
      const result = (await action("/api/reviews", {
        action: "submit",
        cardId: active.id,
        response,
        submissionId,
      })) as { event: ReviewEvent; modelAnswer: string };
      setEvent({ ...result.event, modelAnswer: result.modelAnswer });
    });
  const rate = (rating: Rating) =>
    perform(async () => {
      if (!revealed) return;
      const result = (await action("/api/reviews", {
        action: "rate",
        eventId: revealed.id,
        rating,
      })) as { review: ReviewCard };
      setNotice(
        `حُفظ تقييمك. المراجعة القادمة: ${displayDate(result.review.dueAt, timezone)}.`,
      );
      setActiveId(null);
    });
  const reschedule = () =>
    perform(async () => {
      if (!rescheduling) return;
      await action("/api/reviews", {
        action: "reschedule",
        cardId: rescheduling,
        dueAt: localToUtc(newDate, timezone),
      });
      setRescheduling(null);
      setNotice("حُفظ الموعد الجديد. لم تتغير نتيجة أي محاولة.");
    });
  return (
    <div className="page reviews-page">
      <Link href="/learn" className="back-link">
        تعلّم <ChevronLeft size={15} />
      </Link>
      <header className="page-header">
        <div>
          <p className="eyebrow">فرصة أخرى للاستدعاء</p>
          <h1 className="page-title">
            المراجعات<span className="accent-dot">.</span>
          </h1>
          <p className="page-description">
            تذكّر أولًا. اكشف المعيار. ثم اختر موعد العودة.
          </p>
        </div>
        <span className="pill">
          <RotateCcw size={16} />
          {due.length.toLocaleString("ar-PS")} يحين وقتها الآن
        </span>
      </header>
      {notice && (
        <div className="success-message" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {active ? (
        <section className="lesson-canvas">
          <button
            className="button ghost"
            onClick={() => setActiveId(null)}
            disabled={busy}
          >
            العودة إلى القائمة
          </button>
          <p className="eyebrow">
            {getLesson(active.lessonSlug ?? "")?.title ?? "مراجعة تعليمية"}
          </p>
          <h2>{active.prompt}</h2>
          {!revealed ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label className="field">
                <span className="field-label">ماذا تتذكر، دون فتح المصدر؟</span>
                <textarea
                  aria-label="ماذا تتذكر، دون فتح المصدر؟"
                  rows={5}
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  maxLength={8000}
                  required
                  placeholder="اكتب ما تتذكره…"
                />
              </label>
              <button
                className="button primary"
                type="submit"
                disabled={busy || !response.trim()}
              >
                {busy ? "جارٍ حفظ المحاولة…" : "احفظ إجابتي واكشف المعيار"}
                <ArrowLeft size={17} />
              </button>
              <p className="footnote">
                تُحفظ الإجابة قبل كشف المعيار. التقييم ذاتي، دون تحليل آلي للنص.
              </p>
            </form>
          ) : (
            <div className="feedback-panel">
              <span className="pill">محاولة فعلية محفوظة · تقييم ذاتي</span>
              <h3>المعيار للمقارنة</h3>
              <p>{revealed.modelAnswer}</p>
              <details>
                <summary>إجابتي المحفوظة</summary>
                <p>{revealed.response}</p>
              </details>
              <p>كيف كان استدعاؤك قبل رؤية المعيار؟</p>
              <div className="rating-options">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => rate("again")}
                >
                  أحتاج إعادة · يوم
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => rate("hard")}
                >
                  بصعوبة · يوم
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => rate("good")}
                >
                  تذكّرت · فاصل أطول
                </button>
              </div>
              <p className="footnote">
                القواعد الحالية: فواصل «تذكّرت» ٣، ٧، ١٤، ٣٠ يومًا؛ «أحتاج إعادة»
                تعيد البداية. لا نعدك بنسبة احتفاظ معينة.
              </p>
            </div>
          )}
        </section>
      ) : (
        <>
          {!cards.length && (
            <section className="empty-state">
              <div className="empty-icon">
                <RotateCcw size={30} />
              </div>
              <h2>أول مراجعة تبدأ بمحاولة</h2>
              <p>أكمل درسًا، وستظهر هنا مراجعته وموعدها الحقيقي.</p>
              <Link className="button primary" href="/learn">
                ابدأ مسار التعلم <ArrowLeft size={17} />
              </Link>
            </section>
          )}
          {!!due.length && (
            <section>
              <div className="section-heading">
                <h2>يمكنك البدء الآن</h2>
                <span className="muted">الموعد لا يحدد نتيجتك</span>
              </div>
              <div className="review-list">
                {due.map((card) => renderCard(card, true))}
              </div>
            </section>
          )}
          {!!future.length && (
            <section>
              <div className="section-heading">
                <h2>المراجعات القادمة</h2>
                <span className="muted">{timezone}</span>
              </div>
              <div className="review-list">
                {future.map((card) => renderCard(card, false))}
              </div>
            </section>
          )}
          {!!cards.length && (
            <p className="footnote">
              جدول ثابت موثق (fixed-v1)، وليس ذكاءً اصطناعيًا. تتغير الفواصل وفق
              تقييمك، وتبقى المراجعات المتأخرة متاحة. سجل التقييمات وتغييرات
              الموعد محفوظ.
            </p>
          )}
        </>
      )}
      <Modal
        open={rescheduling !== null}
        title="اختر موعد المراجعة"
        onClose={() => {
          if (!busy) setRescheduling(null);
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void reschedule();
          }}
        >
          <label className="field">
            <span className="field-label">التاريخ والوقت · {timezone}</span>
            <input
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
            />
          </label>
          <p className="footnote">
            تغيير الموعد لا يحتسب إجابة ولا يغيّر أدلة التعلم.
          </p>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <div className="action-row">
            <button
              className="button primary"
              disabled={busy || !newDate}
              type="submit"
            >
              احفظ الموعد
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => setRescheduling(null)}
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
  function renderCard(card: ReviewCard, isDue: boolean) {
    return (
      <article className="review-row" key={card.id}>
        <div className={`review-symbol ${isDue ? "is-due" : ""}`}>
          {card.target === "palace" ? (
            <Map size={22} />
          ) : (
            <RotateCcw size={22} />
          )}
        </div>
        <div className="review-row-content">
          <span className="eyebrow">
            {card.target === "palace"
              ? "قصر الذاكرة"
              : (getLesson(card.lessonSlug ?? "")?.title ?? "مراجعة")}
          </span>
          <h3>{card.prompt}</h3>
          <p className="muted">
            {displayDate(card.dueAt, timezone)}
            {card.lastReviewedAt
              ? ` · آخر مراجعة ${displayDate(card.lastReviewedAt, timezone)}`
              : ""}
          </p>
        </div>
        <div className="action-row">
          {card.target === "palace" ? (
            <Link className="button secondary" href="/palace">
              إلى القصر <ArrowLeft size={16} />
            </Link>
          ) : (
            <button
              className={`button ${isDue ? "primary" : "secondary"}`}
              onClick={() => setActiveId(card.id)}
            >
              {isDue ? "ابدأ المراجعة" : "راجع الآن"}
            </button>
          )}
          <button
            className="icon-button"
            aria-label={`تغيير موعد ${card.prompt}`}
            title="تغيير الموعد"
            onClick={() => {
              setNewDate(localValue(new Date(card.dueAt), timezone));
              setRescheduling(card.id);
            }}
          >
            <CalendarDays size={18} />
          </button>
        </div>
      </article>
    );
  }
}
