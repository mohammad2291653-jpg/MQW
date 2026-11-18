"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronLeft,
  Eye,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { getLesson, type LessonStep } from "@/lib/lessons";
import type { Answer, LessonAttempt, Rating } from "@/lib/types";
import { request, useApp } from "@/components/app-provider";

function dateLabel(value: string, timezone = "Asia/Hebron") {
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
export default function LessonPlayer({ slug }: { slug: string }) {
  const { state, action } = useApp();
  const lesson = getLesson(slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<string | string[]>("");
  const [selectedAttempt, setSelectedAttempt] = useState<string | null>(null);
  const [savedAnswer, setSavedAnswer] = useState<Answer | null>(null);
  const [submissionId, setSubmissionId] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const attempts = useMemo(
    () =>
      state?.lessonAttempts
        .filter((attempt) => attempt.lessonSlug === slug)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) ?? [],
    [state?.lessonAttempts, slug],
  );
  const attempt =
    attempts.find((a) => a.id === selectedAttempt) ??
    attempts.find((a) => a.status === "in_progress") ??
    attempts[0];
  const stepIndex = Math.min(
    Math.max(attempt?.step ?? 0, 0),
    (lesson?.steps.length ?? 1) - 1,
  );
  const step = lesson?.steps[stepIndex];
  const questionId = step && "questionId" in step ? step.questionId : null;
  const persistedAnswer = state?.answers.find(
    (answer) =>
      answer.attemptId === attempt?.id && answer.questionId === questionId,
  );
  const answer =
    persistedAnswer ??
    (savedAnswer?.attemptId === attempt?.id &&
    savedAnswer?.questionId === questionId
      ? savedAnswer
      : null);
  useEffect(() => {
    const draft =
      attempt?.draftQuestionId === questionId ? attempt?.draftResponse : null;
    setResponse(
      typeof draft === "string" ||
        (Array.isArray(draft) &&
          draft.every((item) => typeof item === "string"))
        ? draft
        : step?.type === "order" || step?.type === "match"
          ? (step.options?.map((option) => option.id) ?? [])
          : "",
    );
    setSavedAnswer(null);
    setSubmissionId(crypto.randomUUID());
    setError("");
    setDraftStatus("");
    // A server refresh must not replace a response the learner is currently editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.id, stepIndex, step]);
  useEffect(() => {
    if (
      !attempt ||
      !questionId ||
      answer ||
      busy ||
      attempt.status === "completed"
    )
      return;
    let current = true;
    const timer = setTimeout(() => {
      setDraftStatus("جارٍ حفظ المسودة…");
      request("/api/learning", {
        method: "POST",
        body: JSON.stringify({
          action: "progress",
          attemptId: attempt.id,
          step: stepIndex,
          draftQuestionId: questionId,
          draftResponse: response,
        }),
      })
        .then(() => {
          if (current) setDraftStatus("مسودة خاصة محفوظة؛ لم تُسجّل محاولة بعد.");
        })
        .catch(() => {
          if (current)
            setDraftStatus(
              "المسودة في هذه الصفحة. تعذّر حفظها؛ أبقِ الصفحة مفتوحة وحاول مجددًا.",
            );
        });
    }, 700);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [
    attempt?.id,
    attempt?.status,
    questionId,
    stepIndex,
    response,
    answer?.id,
    busy,
  ]);

  async function perform(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (failure) {
      setError(
        failure instanceof TypeError
          ? "تعذّر الاتصال. إجابتك ما زالت هنا؛ حاول الحفظ مجددًا."
          : failure instanceof Error
            ? failure.message
            : "تعذّر الحفظ. إجابتك ما زالت هنا، حاول مجددًا.",
      );
    } finally {
      setBusy(false);
    }
  }
  const start = () =>
    perform(async () => {
      const result = (await action("/api/learning", {
        action: "start",
        lessonSlug: slug,
      })) as { attempt: LessonAttempt };
      setSelectedAttempt(result.attempt.id);
    });
  const next = () =>
    perform(async () => {
      if (!attempt) return;
      await action("/api/learning", {
        action: "progress",
        attemptId: attempt.id,
        step: stepIndex + 1,
      });
    });
  const submit = () =>
    perform(async () => {
      if (!attempt || !questionId) return;
      const result = (await action("/api/learning", {
        action: "submit",
        attemptId: attempt.id,
        questionId,
        response,
        submissionId,
      })) as { answer: Answer };
      setSavedAnswer(result.answer);
    });
  const rate = (rating: Rating) =>
    perform(async () => {
      if (!answer) return;
      const result = (await action("/api/learning", {
        action: "self-grade",
        answerId: answer.id,
        rating,
        submissionId: `${answer.id}-rating`,
      })) as { answer: Answer };
      setSavedAnswer(result.answer);
    });
  const complete = () =>
    perform(async () => {
      if (attempt)
        await action("/api/learning", {
          action: "complete",
          attemptId: attempt.id,
        });
    });

  if (!lesson)
    return (
      <div className="page">
        <h1>لم نجد هذا الدرس</h1>
        <Link href="/learn" className="button primary">
          العودة إلى التعلّم
        </Link>
      </div>
    );
  const errorBanner = error && (
    <div className="error-message" role="alert">
      {error}
      <span> لا نعرض نتيجة قبل تأكيد الحفظ.</span>
    </div>
  );
  if (!attempt || attempt.status === "completed") {
    const review = state?.reviews.find((card) => card.lessonSlug === slug);
    return (
      <div className="page lesson-page">
        <Link className="back-link" href="/learn">
          تعلّم <ChevronLeft size={15} />
        </Link>
        <div className="lesson-welcome">
          <p className="eyebrow">
            الدرس {lesson.number.toLocaleString("ar-PS")} / {lesson.english}
          </p>
          {attempt?.status === "completed" && (
            <span className="pill success">
              <CheckCircle2 size={17} /> اكتمل وحُفظ
            </span>
          )}
          <h1>{lesson.title}</h1>
          <p className="page-description">{lesson.description}</p>
          <div className="lesson-outcome">
            <span className="eyebrow">ما الذي ستجرّبه؟</span>
            <p>{lesson.outcome}</p>
            <small>{lesson.duration} · يمكنك التوقف والمتابعة لاحقًا</small>
          </div>
          {review && (
            <p className="review-date">
              المراجعة القادمة:{" "}
              {dateLabel(review.dueAt, state?.preferences.timezone)}
            </p>
          )}
          {errorBanner}
          <div className="action-row">
            <button className="button primary" disabled={busy} onClick={start}>
              {busy
                ? "جارٍ الحفظ…"
                : attempt
                  ? "جرّب الدرس من جديد"
                  : "ابدأ التجربة"}
              <ArrowLeft size={18} />
            </button>
            {review && (
              <Link className="button secondary" href="/reviews">
                اعرض المراجعة وموعدها
              </Link>
            )}
          </div>
          <p className="footnote">
            <ShieldCheck size={15} /> نتائجك خاصة. لا تحتاج إلى AI أو رفع
            ملفاتك.
          </p>
        </div>
      </div>
    );
  }
  const isQuestion =
    step &&
    [
      "single_choice",
      "multiple_choice",
      "order",
      "match",
      "short_answer_self_check",
    ].includes(step.type);
  const canContinue =
    answer &&
    (answer.gradingSource === "deterministic" ||
      answer.gradingSource === "self_report");
  return (
    <div className="page lesson-page">
      <div className="lesson-toolbar">
        <Link href="/learn" className="back-link">
          العودة للتعلّم <ChevronLeft size={15} />
        </Link>
        <span className="muted">
          الدرس {lesson.number.toLocaleString("ar-PS")} · {lesson.title}
        </span>
        <span className="pill">
          {(stepIndex + 1).toLocaleString("ar-PS")} /{" "}
          {lesson.steps.length.toLocaleString("ar-PS")}
        </span>
      </div>
      <div
        className="progress-track"
        aria-label={`الخطوة ${stepIndex + 1} من ${lesson.steps.length}`}
      >
        <span
          style={{ width: `${((stepIndex + 1) / lesson.steps.length) * 100}%` }}
        />
      </div>
      <section className="lesson-canvas" aria-busy={busy}>
        <p className="eyebrow">
          {step?.type === "explainer"
            ? "الفكرة أولًا"
            : step?.type === "review_creation"
              ? "مساحة للعودة"
              : "حان وقت التجربة"}
        </p>
        <h1 key={step?.id}>{step?.title}</h1>
        {step?.type === "explainer" && (
          <div className="lesson-explainer">
            {step.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {step.takeaway && <blockquote>{step.takeaway}</blockquote>}
            <button className="button primary" onClick={next} disabled={busy}>
              أخْفِ المصدر وابدأ <ArrowLeft size={18} />
            </button>
          </div>
        )}
        {step?.type === "confidence" && (
          <>
            <p className="question-prompt">{step.prompt}</p>
            {!answer ? (
              <>
                <div className="confidence-options">
                  {Array.from({ length: step.maximum + 1 }, (_, value) => (
                    <button
                      key={value}
                      className={`choice-option ${response === String(value) ? "selected" : ""}`}
                      onClick={() => setResponse(String(value))}
                      aria-pressed={response === String(value)}
                    >
                      {value.toLocaleString("ar-PS")} من{" "}
                      {step.maximum.toLocaleString("ar-PS")}
                    </button>
                  ))}
                </div>
                <div className="action-row">
                  <button
                    className="button primary"
                    disabled={busy || response === ""}
                    onClick={submit}
                  >
                    احفظ توقعي
                  </button>
                  <button
                    className="button ghost"
                    disabled={busy}
                    onClick={next}
                  >
                    تخطي التوقع
                  </button>
                </div>
              </>
            ) : (
              <div className="feedback-panel">
                <p>
                  حُفظ توقعك: {String(answer.response)} من{" "}
                  {step.maximum.toLocaleString("ar-PS")}.
                </p>
                <button
                  className="button primary"
                  onClick={next}
                  disabled={busy}
                >
                  إلى الاختبار <ArrowLeft size={17} />
                </button>
              </div>
            )}
          </>
        )}
        {isQuestion && step && "prompt" in step && (
          <>
            <p className="question-prompt">{step.prompt}</p>
            {!answer ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                {step.type === "short_answer_self_check" && (
                  <label className="field">
                    <span className="field-label">إجابتك قبل الكشف</span>
                    <textarea
                      aria-label="إجابتك قبل الكشف"
                      rows={5}
                      value={typeof response === "string" ? response : ""}
                      onChange={(event) => setResponse(event.target.value)}
                      placeholder={step.placeholder}
                      maxLength={8000}
                      required
                      autoComplete="off"
                    />
                  </label>
                )}
                {(step.type === "single_choice" ||
                  step.type === "multiple_choice") && (
                  <fieldset className="choices">
                    <legend className="sr-only">اختر إجابتك</legend>
                    {step.options?.map((option) => {
                      const selected = Array.isArray(response)
                        ? response.includes(option.id)
                        : response === option.id;
                      return (
                        <label
                          className={`choice-option ${selected ? "selected" : ""}`}
                          key={option.id}
                        >
                          <input
                            type={
                              step.type === "multiple_choice"
                                ? "checkbox"
                                : "radio"
                            }
                            name={step.questionId}
                            value={option.id}
                            checked={selected}
                            onChange={() =>
                              setResponse(
                                step.type === "multiple_choice"
                                  ? selected
                                    ? (Array.isArray(response)
                                        ? response
                                        : []
                                      ).filter((id) => id !== option.id)
                                    : [
                                        ...(Array.isArray(response)
                                          ? response
                                          : []),
                                        option.id,
                                      ]
                                  : option.id,
                              )
                            }
                          />
                          <span>{option.label}</span>
                          {selected && <Check size={18} />}
                        </label>
                      );
                    })}
                  </fieldset>
                )}
                {(step.type === "order" || step.type === "match") && (
                  <ol className="ordering-list">
                    {(Array.isArray(response) ? response : []).map(
                      (id, index, ids) => (
                        <li key={id}>
                          <span className="order-index">
                            {(index + 1).toLocaleString("ar-PS")}
                          </span>
                          <span>
                            {
                              step.options?.find((option) => option.id === id)
                                ?.label
                            }
                          </span>
                          <div>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`رفع العنصر ${index + 1}`}
                              disabled={!index || busy}
                              onClick={() => {
                                const items = [...ids];
                                [items[index - 1], items[index]] = [
                                  items[index],
                                  items[index - 1],
                                ];
                                setResponse(items);
                              }}
                            >
                              <ArrowUp size={18} />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`خفض العنصر ${index + 1}`}
                              disabled={index === ids.length - 1 || busy}
                              onClick={() => {
                                const items = [...ids];
                                [items[index + 1], items[index]] = [
                                  items[index],
                                  items[index + 1],
                                ];
                                setResponse(items);
                              }}
                            >
                              <ArrowDown size={18} />
                            </button>
                          </div>
                        </li>
                      ),
                    )}
                  </ol>
                )}
                {"hint" in step && step.hint && (
                  <p className="footnote">{step.hint}</p>
                )}
                <p className="footnote draft-status" role="status">
                  {draftStatus}
                </p>
                <button
                  type="submit"
                  className="button primary"
                  disabled={
                    busy ||
                    (Array.isArray(response)
                      ? !response.length
                      : !response.trim())
                  }
                >
                  {busy
                    ? "جارٍ حفظ الإجابة…"
                    : step.type === "short_answer_self_check"
                      ? "احفظ إجابتي واكشف المعيار"
                      : "احفظ إجابتي وتحقّق"}
                  <Eye size={17} />
                </button>
              </form>
            ) : (
              <div className="feedback-panel" role="status">
                <span className={`pill ${answer.correct ? "success" : ""}`}>
                  {answer.gradingSource === "deterministic"
                    ? answer.correct
                      ? "إجابة صحيحة · تقييم آلي محدد"
                      : "فرصة لتوضيح الفكرة · تقييم آلي محدد"
                    : answer.gradingSource === "self_report"
                      ? "تقييم ذاتي محفوظ"
                      : "إجابتك حُفظت · قيّمها بنفسك"}
                </span>
                <h2>لماذا؟</h2>
                <p>{answer.feedback}</p>
                {answer.modelAnswer && (
                  <div className="model-answer">
                    <span className="eyebrow">الإجابة / المعيار</span>
                    <p>{answer.modelAnswer}</p>
                  </div>
                )}
                <details>
                  <summary>اعرض إجابتي المحفوظة</summary>
                  <p>
                    {Array.isArray(answer.response)
                      ? answer.response
                          .map((value) =>
                            "options" in step
                              ? (step.options?.find(
                                  (option) => option.id === value,
                                )?.label ?? value)
                              : value,
                          )
                          .join(" ← ")
                      : "options" in step
                        ? (step.options?.find(
                            (option) => option.id === answer.response,
                          )?.label ?? answer.response)
                        : answer.response}
                  </p>
                </details>
                {answer.gradingSource === "ungraded" && (
                  <>
                    <p className="field-label">
                      بصدق، كيف كانت إجابتك مقارنة بالمعيار؟
                    </p>
                    <div className="rating-options">
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => rate("again")}
                      >
                        أحتاج إعادة
                      </button>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => rate("hard")}
                      >
                        جزئيًا / بصعوبة
                      </button>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => rate("good")}
                      >
                        تذكّرت / أنجزت المعيار
                      </button>
                    </div>
                  </>
                )}
                {canContinue && (
                  <button
                    className="button primary"
                    onClick={next}
                    disabled={busy}
                  >
                    تابع التجربة <ArrowLeft size={17} />
                  </button>
                )}
                <p className="footnote">
                  المحاولة محفوظة. يمكنك إعادة الدرس لاحقًا دون محو هذه النتيجة.
                </p>
              </div>
            )}
          </>
        )}
        {step?.type === "review_creation" && (
          <>
            <div className="lesson-explainer">
              {step.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {slug === "metacognitive-calibration" && (
              <Calibration attemptId={attempt.id} />
            )}
            <div className="review-promise">
              <RotateCcw size={23} />
              <div>
                <strong>المراجعة الأولى بعد يوم</strong>
                <p>
                  تظهر بتاريخ حقيقي قابل للتعديل، وتُحفظ نتائج العودة منفصلة.
                </p>
              </div>
            </div>
            <button
              className="button primary"
              disabled={busy}
              onClick={complete}
            >
              {busy ? "جارٍ إكمال الدرس…" : "أكمل واحفظ موعد المراجعة"}
              <CheckCircle2 size={18} />
            </button>
          </>
        )}
        {step?.type === "reflection" && (
          <>
            <p>{step.prompt}</p>
            <p className="muted">
              فكّر في الإجابة لنفسك؛ لا نحلل أفكارك الخاصة.
            </p>
            <button className="button primary" onClick={next} disabled={busy}>
              متابعة
            </button>
          </>
        )}
        {errorBanner}
      </section>
      <p className="lesson-privacy footnote">
        <ShieldCheck size={14} /> الحفظ قبل التغذية الراجعة · الأمثلة تعليمية ·
        إصدار المحتوى {lesson.version}
      </p>
    </div>
  );
}

function Calibration({ attemptId }: { attemptId: string }) {
  const { state } = useApp();
  const answers =
    state?.answers.filter((answer) => answer.attemptId === attemptId) ?? [];
  const prediction = answers.find(
    (answer) => answer.questionId === "prediction",
  );
  const scored = answers.filter(
    (answer) =>
      ["organelle", "membrane"].includes(answer.questionId) &&
      answer.gradingSource === "deterministic",
  );
  if (scored.length !== 2) return null;
  return (
    <div className="calibration-summary panel">
      <h2>توقع ونتيجة، دون تصنيف</h2>
      <div className="calibration-numbers">
        <div>
          <span className="muted">توقعك</span>
          <strong>
            {prediction ? `${prediction.response} / ٢` : "لم تسجل توقعًا"}
          </strong>
        </div>
        <div>
          <span className="muted">النتيجة المحفوظة</span>
          <strong>
            {scored
              .filter((answer) => answer.correct)
              .length.toLocaleString("ar-PS")}{" "}
            / ٢
          </strong>
        </div>
      </div>
      <p className="footnote">
        هذه عينة من سؤالين في هذه الجلسة. لا تكفي لاستنتاج نمط ثابت أو سمة
        شخصية.
      </p>
    </div>
  );
}
