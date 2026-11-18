"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  ChevronLeft,
  CirclePlus,
  Pause,
  Play,
  Square,
  X,
} from "lucide-react";
import type { StudySession, Subject } from "@/lib/types";
import { useApp } from "@/components/app-provider";
import { Modal } from "@/components/ui";

const PRESETS = [15, 25, 45, 60, 90];
export default function StudyPage() {
  const { state, create, update, remove } = useApp();
  const [subject, setSubject] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [custom, setCustom] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [topics, setTopics] = useState("");
  const [outcome, setOutcome] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const active = state?.studySessions.find(
    (session) => session.status !== "completed",
  );
  useEffect(() => {
    setOutcome(active?.outcome ?? "");
  }, [active?.id]);
  useEffect(() => {
    if (state?.preferences.studyMinutes)
      setMinutes(state.preferences.studyMinutes);
  }, [state?.preferences.studyMinutes]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = active
    ? Math.max(
        0,
        Math.floor(
          active.elapsedSeconds +
            (active.status === "running"
              ? (now -
                  new Date(active.resumedAt ?? active.startedAt).getTime()) /
                1000
              : 0),
        ),
      )
    : 0;
  const remaining = active
    ? Math.max(0, active.minutes * 60 - elapsed)
    : minutes * 60;
  async function perform(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حفظ الجلسة. حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  }
  const start = () =>
    perform(async () => {
      await create<StudySession>("studySessions", {
        subject,
        minutes,
        status: "running",
        startedAt: new Date().toISOString(),
        resumedAt: new Date().toISOString(),
        elapsedSeconds: 0,
      });
      setOutcome("");
      setNow(Date.now());
    });
  const toggle = () =>
    perform(async () => {
      if (!active) return;
      await update(
        "studySessions",
        active.id,
        active.status === "running"
          ? { status: "paused", elapsedSeconds: elapsed, outcome }
          : { status: "running", resumedAt: new Date().toISOString(), outcome },
      );
      setNow(Date.now());
    });
  const finish = () =>
    perform(async () => {
      if (!active) return;
      await update("studySessions", active.id, {
        status: "completed",
        elapsedSeconds: elapsed,
        outcome,
      });
      setNotice("حُفظت الجلسة بوقتها المسجل. يمكنك الآن اختبار فكرة مما درست.");
      setOutcome("");
    });
  const saveSubject = () =>
    perform(async () => {
      const values = {
        title: title.trim(),
        topics: topics
          .split("\n")
          .map((topic) => topic.trim())
          .filter(Boolean),
      };
      if (editing) await update("subjects", editing, values);
      else await create<Subject>("subjects", values);
      setAdding(false);
      setEditing(null);
      setTitle("");
      setTopics("");
    });
  return (
    <div className="page study-page">
      <Link href="/learn" className="back-link">
        تعلّم <ChevronLeft size={15} />
      </Link>
      <header className="page-header">
        <div>
          <p className="eyebrow">وقت يناسب يومك</p>
          <h1 className="page-title">
            مساحة الدراسة<span className="accent-dot">.</span>
          </h1>
          <p className="page-description">
            موضوع تختاره، جلسة مرنة، وفكرة تختبرها.
          </p>
        </div>
      </header>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="success-message" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      <section className="study-timer panel">
        <div className="study-timer-heading">
          <span className="eyebrow">
            {active ? active.subject || "جلسة حرة" : "جلسة جديدة"}
          </span>
          {active && (
            <span className="pill">
              {active.status === "running" ? "الوقت جارٍ" : "متوقفة مؤقتًا"}
            </span>
          )}
        </div>
        {!active && (
          <label className="field">
            <span className="field-label">ماذا ستدرس؟</span>
            <select
              aria-label="ماذا ستدرس؟"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">جلسة حرة دون مادة</option>
              {state?.subjects.map((item) => (
                <optgroup label={item.title} key={item.id}>
                  <option value={item.title}>{item.title}</option>
                  {item.topics.map((topic) => (
                    <option value={`${item.title} · ${topic}`} key={topic}>
                      {topic}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        )}
        <div
          className="timer-display"
          role="timer"
          aria-label={`${Math.floor(remaining / 60)} دقيقة و${remaining % 60} ثانية متبقية`}
          dir="ltr"
        >
          {String(Math.floor(remaining / 60)).padStart(2, "0")}
          <span>:</span>
          {String(remaining % 60).padStart(2, "0")}
        </div>
        {active ? (
          <>
            <p className="muted timer-caption">
              {remaining
                ? `المخطط ${active.minutes.toLocaleString("ar-PS")} دقيقة · المسجل ${Math.floor(elapsed / 60).toLocaleString("ar-PS")} دقيقة`
                : "انتهى الوقت المخطط. يمكنك الاستمرار أو إنهاء الجلسة بهدوء."}
            </p>
            <div className="action-row timer-controls">
              <button
                className="button secondary"
                onClick={toggle}
                disabled={busy}
              >
                {active.status === "running" ? (
                  <Pause size={18} />
                ) : (
                  <Play size={18} />
                )}{" "}
                {active.status === "running" ? "إيقاف مؤقت" : "متابعة"}
              </button>
              <button
                className="button primary"
                onClick={finish}
                disabled={busy}
              >
                <Square size={16} /> إنهاء وحفظ
              </button>
            </div>
            <label className="field">
              <span className="field-label">
                ما الفكرة التي تستطيع اختبارها؟ اختياري
              </span>
              <textarea
                rows={2}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                maxLength={5000}
                placeholder="مثال: أشرح وظيفة الغشاء دون الرجوع إلى المصدر."
              />
            </label>
          </>
        ) : (
          <>
            <div className="duration-options" aria-label="مدة الجلسة">
              {PRESETS.map((value) => (
                <button
                  className={`duration-option ${minutes === value && !custom ? "selected" : ""}`}
                  key={value}
                  onClick={() => {
                    setCustom(false);
                    setMinutes(value);
                  }}
                  aria-pressed={minutes === value && !custom}
                >
                  {value.toLocaleString("ar-PS")} د
                </button>
              ))}
              <button
                className={`duration-option ${custom ? "selected" : ""}`}
                onClick={() => setCustom(true)}
                aria-pressed={custom}
              >
                مخصص
              </button>
            </div>
            {custom && (
              <label className="field custom-minutes">
                <span className="field-label">دقائق، من ١ إلى ٤٨٠</span>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                />
              </label>
            )}
            <button
              className="button primary"
              onClick={start}
              disabled={
                busy ||
                !Number.isFinite(minutes) ||
                minutes < 1 ||
                minutes > 480
              }
            >
              <Play size={18} /> ابدأ جلسة الدراسة
            </button>
          </>
        )}
        <p className="footnote">
          المؤقت يسجل الوقت المنقضي، ولا يقيس انتباهك أو حالتك النفسية. التوقف
          متاح دائمًا.
        </p>
      </section>
      <section>
        <div className="section-heading">
          <h2>موادك، بطريقتك</h2>
          <button
            className="button secondary"
            onClick={() => {
              setEditing(null);
              setTitle("");
              setTopics("");
              setAdding(true);
            }}
          >
            <CirclePlus size={17} /> إضافة مادة
          </button>
        </div>
        {!state?.subjects.length ? (
          <div className="empty-state compact">
            <BookOpen size={25} />
            <h3>ابدأ بمادة واحدة</h3>
            <p>
              أضف فصولًا أو محاضرات أو موضوعات كما تحب. لا نستورد ملفاتك تلقائيًا.
            </p>
          </div>
        ) : (
          <div className="subject-list">
            {state.subjects.map((item) => (
              <article className="subject-row" key={item.id}>
                <BookOpen size={22} />
                <div>
                  <h3>{item.title}</h3>
                  {item.topics.length ? (
                    <div className="topic-tags">
                      {item.topics.map((topic, index) => (
                        <span className="pill" key={`${topic}-${index}`}>
                          {topic}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">أضف فصولًا أو محاضرات عندما تحتاج.</p>
                  )}
                </div>
                <button
                  className="button ghost"
                  onClick={() => {
                    setEditing(item.id);
                    setTitle(item.title);
                    setTopics(item.topics.join("\n"));
                    setAdding(true);
                  }}
                >
                  تعديل
                </button>
                <button
                  className="icon-button"
                  disabled={busy}
                  aria-label={`حذف المادة ${item.title}`}
                  onClick={() =>
                    perform(async () => {
                      await remove("subjects", item.id);
                    })
                  }
                >
                  <X size={17} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      {!!state?.studySessions.filter(
        (session) => session.status === "completed",
      ).length && (
        <section>
          <div className="section-heading">
            <h2>جلسات محفوظة</h2>
            <span className="muted">سجل فعلي، دون تقييم للتركيز</span>
          </div>
          <div className="session-history">
            {state.studySessions
              .filter((session) => session.status === "completed")
              .slice()
              .reverse()
              .slice(0, 8)
              .map((session) => (
                <article key={session.id}>
                  <div>
                    <h3>{session.subject || "جلسة حرة"}</h3>
                    <p className="muted">
                      {new Intl.DateTimeFormat("ar", {
                        dateStyle: "medium",
                        timeZone: state.preferences.timezone,
                      }).format(new Date(session.startedAt))}
                    </p>
                    {session.outcome && <p>{session.outcome}</p>}
                  </div>
                  <span className="pill">
                    {Math.floor(session.elapsedSeconds / 60).toLocaleString(
                      "ar-PS",
                    )}{" "}
                    دقيقة مسجلة
                  </span>
                </article>
              ))}
          </div>
        </section>
      )}
      <Modal
        open={adding}
        title={editing ? "تعديل المادة" : "مادة جديدة"}
        onClose={() => {
          if (!busy) setAdding(false);
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveSubject();
          }}
        >
          <label className="field">
            <span className="field-label">اسم المادة</span>
            <input
              required
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلًا: الأحياء العامة"
            />
          </label>
          <label className="field">
            <span className="field-label">
              فصول / محاضرات / موضوعات · كل واحد في سطر
            </span>
            <textarea
              rows={5}
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder={"الخلية\nانتقال المواد\nالوراثة"}
            />
          </label>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="action-row">
            <button
              className="button primary"
              type="submit"
              disabled={busy || !title.trim()}
            >
              احفظ المادة
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => setAdding(false)}
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
