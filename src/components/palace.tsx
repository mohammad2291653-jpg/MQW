"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  Compass,
  Eye,
  EyeOff,
  Footprints,
  House,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { PalaceMap, PalaceScene } from "./palace-map";
import {
  EXAMPLE_ASSOCIATIONS,
  LOCI,
  RATING_LABELS,
  getLocus,
  palaceTrialIsFinished,
  trialLocusIds,
  trialSummary,
  type LocusId,
} from "@/lib/palace";
import type { Association, PalaceTrial, Rating } from "@/lib/types";
import "./palace.css";

function futureDate(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString();
}
function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("ar", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function dateAtNine(date: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, 9);
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(guess).map((part) => [part.type, part.value]),
    );
    const actual = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour,
      +parts.minute,
      +parts.second,
    );
    guess += target - actual;
  }
  return new Date(guess).toISOString();
}

export default function PalacePage({ path = [] }: { path?: string[] }) {
  const { state, loading, error: appError, refresh, action } = useApp();
  const [selected, setSelected] = useState<LocusId>("entrance");
  const [mode, setMode] = useState<"explore" | "tour" | "trial" | "results">(
    "explore",
  );
  const [visited, setVisited] = useState<string[]>([]);
  const [editor, setEditor] = useState(false);
  const [fact, setFact] = useState("");
  const [image, setImage] = useState("");
  const [localTrial, setLocalTrial] = useState<PalaceTrial | null>(null);
  const [trialIndex, setTrialIndex] = useState(0);
  const [response, setResponse] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retestAt, setRetestAt] = useState(futureDate(1));
  const [customDate, setCustomDate] = useState("");
  const [confirmExamples, setConfirmExamples] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const associations = state?.associations ?? [];
  const trials = state?.palaceTrials ?? [];
  const timezone = state?.preferences.timezone ?? "Asia/Hebron";
  const locus = getLocus(selected) ?? LOCI[0];
  const association = associations.find((item) => item.locusId === selected);
  const activeTrials = trials.filter((trial) => trial.status === "in_progress");
  const completed = trials.filter((trial) => trial.status === "completed");
  const trial = localTrial;
  const ids = useMemo(
    () => (trial ? trialLocusIds(trial, associations) : []),
    [trial, associations],
  );
  const currentId = ids[trialIndex];
  const currentResult = trial?.results.find(
    (result) => result.locusId === currentId,
  );
  const trialDone = trial ? palaceTrialIsFinished(trial, ids) : false;
  const currentLocus = getLocus(currentId);

  useEffect(() => {
    setResponse("");
  }, [trialIndex, localTrial?.id]);
  useEffect(() => {
    if (!editor && !confirmExamples) return;
    const previous = document.activeElement;
    const dialog = document.querySelector<HTMLElement>(
      '.palace-editor[role="dialog"]',
    );
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLElement>("textarea, button, input")?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setEditor(false);
        setConfirmExamples(false);
      }
      if (event.key !== "Tab" || !dialog) return;
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [tabindex="0"]',
        ),
      ];
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      document.body.style.overflow = oldOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [editor, confirmExamples]);
  useEffect(() => {
    const id = path.at(-1);
    if (!id || !trials.length || localTrial) return;
    const found = trials.find((item) => item.id === id);
    if (found) {
      setLocalTrial(found);
      setMode(found.status === "completed" ? "results" : "trial");
    }
  }, [path, trials, localTrial]);

  async function run<T>(callback: () => Promise<T>): Promise<T | undefined> {
    if (pending) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      return await callback();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "تعذّر الحفظ. يمكنك إعادة المحاولة.",
      );
    } finally {
      setPending(false);
    }
  }
  function choose(id: LocusId) {
    setSelected(id);
    setVisited((old) => (old.includes(id) ? old : [...old, id]));
    setNotice("");
  }
  function openEditor() {
    setFact(association?.fact ?? "");
    setImage(association?.image ?? "");
    setConfirmDelete(false);
    setEditor(true);
    setError("");
  }
  async function saveAssociation(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      await action("/api/palace", {
        action: "save-association",
        locusId: selected,
        fact,
        image,
      });
      setEditor(false);
      setNotice("حُفظ الرابط. اختبره لاحقًا من دون كشف الصورة الذهنية.");
    });
  }
  async function start(kind: "concept" | "route") {
    await run(async () => {
      const next = await action<PalaceTrial>("/api/palace", {
        action: "start",
        kind,
      });
      setLocalTrial(next);
      const nextIds = trialLocusIds(next, associations);
      const index = nextIds.findIndex(
        (id) =>
          !next.results.some(
            (result) =>
              result.locusId === id && (result.rating || result.skipped),
          ),
      );
      setTrialIndex(index < 0 ? Math.max(0, nextIds.length - 1) : index);
      setResponse("");
      setRetestAt(futureDate(1));
      setMode("trial");
    });
  }
  function resume(item: PalaceTrial) {
    const nextIds = trialLocusIds(item, associations);
    const index = nextIds.findIndex(
      (id) =>
        !item.results.some(
          (result) =>
            result.locusId === id && (result.rating || result.skipped),
        ),
    );
    setLocalTrial(item);
    setTrialIndex(index < 0 ? Math.max(0, nextIds.length - 1) : index);
    setMode("trial");
    setError("");
  }
  async function trialAction(
    actionName: string,
    extra: Record<string, unknown> = {},
  ) {
    if (!trial) return;
    return run(async () => {
      const next = await action<PalaceTrial>("/api/palace", {
        action: actionName,
        trialId: trial.id,
        locusId: currentId,
        ...extra,
      });
      setLocalTrial(next);
      return next;
    });
  }
  async function cannotRecall() {
    if (!trial) return;
    await run(async () => {
      await action<PalaceTrial>("/api/palace", {
        action: "submit",
        trialId: trial.id,
        locusId: currentId,
        response: "",
      });
      const next = await action<PalaceTrial>("/api/palace", {
        action: "reveal",
        trialId: trial.id,
        locusId: currentId,
      });
      setLocalTrial(next);
    });
  }
  async function finish() {
    if (!trial) return;
    await run(async () => {
      const next = await action<PalaceTrial>("/api/palace", {
        action: "complete",
        trialId: trial.id,
        retestAt,
      });
      setLocalTrial(next);
      setMode("results");
    });
  }
  function nextLocus() {
    if (trialIndex < ids.length - 1) {
      setTrialIndex((index) => index + 1);
      setError("");
    }
  }

  if (loading)
    return (
      <div className="palace-loading" role="status">
        <House size={32} />
        <p>نفتح أبواب قصرك…</p>
      </div>
    );
  if (!state)
    return (
      <div className="palace-loading">
        <p role="alert">{appError || "تعذّر تحميل القصر."}</p>
        <button className="btn btn-secondary" onClick={() => refresh()}>
          إعادة المحاولة
        </button>
      </div>
    );

  return (
    <div className="palace-page">
      <header className="page-header palace-page-header">
        <div>
          <p className="eyebrow">
            <span className="palace-eyebrow-line" /> فنّ التذكّر · Memory Palace
          </p>
          <h1>مكانٌ لكل معلومة.</h1>
          <p className="muted">ابنِ رابطًا تتخيّله، ثم امشِ في طريقك لتسترجعه.</p>
        </div>
        <span className="palace-house-label">
          <House size={18} /> بيتك الأوّل <span>01</span>
        </span>
      </header>

      {error && (
        <div className="palace-message palace-error" role="alert">
          {error}
          <button
            type="button"
            aria-label="إغلاق رسالة الخطأ"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="palace-message palace-success" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}

      {(mode === "explore" || mode === "tour") && (
        <>
          <div className="palace-intro-strip">
            <div className="palace-intro-icon">
              <Compass size={23} />
            </div>
            <p>
              <strong>من مكان مألوف… إلى تذكّر أوضح.</strong>
              <span>
                خمسة مواقع ثابتة. صورة ذهنية لكل موقع. واختبار حقيقي قبل كشف
                الإجابات.
              </span>
            </p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                choose("entrance");
                setMode("tour");
              }}
            >
              جولة إرشادية <ArrowLeft size={16} />
            </button>
          </div>

          {activeTrials.length > 0 && (
            <div className="palace-resume">
              <Footprints size={20} />
              <div>
                <strong>خطواتك محفوظة.</strong>
                <p>
                  لديك اختبار غير مكتمل. يمكنك المتابعة من آخر مكان وصلت إليه.
                </p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => resume(activeTrials[0])}
              >
                متابعة الاختبار <ArrowLeft size={15} />
              </button>
            </div>
          )}

          <section
            className="palace-workspace"
            aria-label="استكشاف بيت الذاكرة"
          >
            <div className="palace-plan-panel">
              <div className="palace-section-top">
                <div>
                  <span className="palace-overline">خريطة البيت</span>
                  <h2>طريق واحد، خمس محطّات</h2>
                </div>
                <span className="palace-floor-label">مخطط ثنائي الأبعاد</span>
              </div>
              <PalaceMap
                selected={selected}
                onSelect={choose}
                linked={associations.map((item) => item.locusId)}
                visited={visited}
              />
              <nav className="palace-route-list" aria-label="المواقع بالترتيب">
                {LOCI.map((place) => (
                  <button
                    type="button"
                    key={place.id}
                    onClick={() => choose(place.id)}
                    aria-current={selected === place.id ? "step" : undefined}
                    className={selected === place.id ? "is-selected" : ""}
                  >
                    <span>{place.number}</span>
                    {place.name}
                    {associations.some((item) => item.locusId === place.id) && (
                      <Check size={12} aria-label="مرتبط بمعلومة" />
                    )}
                  </button>
                ))}
              </nav>
              <p className="palace-map-caption">
                <span className="palace-linked-dot" /> رابط محفوظ{" "}
                <span className="palace-caption-separator">·</span> اختر أي مكان
                بالنقر أو بلوحة المفاتيح.
              </p>
            </div>

            <aside
              className="palace-place-panel"
              aria-label={`المكان المحدد: ${locus.name}`}
            >
              <div className="palace-place-title">
                <div>
                  <span className="palace-overline">
                    المكان {locus.number} من ٥
                  </span>
                  <h2>{locus.name}</h2>
                </div>
                <span className="palace-place-number">0{locus.number}</span>
              </div>
              <div className="palace-scene-frame">
                <PalaceScene locusId={selected} />
                <span className="palace-scene-caption">{locus.english}</span>
              </div>
              <p className="palace-place-cue">
                <MapPin size={16} />
                {locus.cue}
              </p>

              {mode === "tour" ? (
                <div className="palace-tour-content">
                  <p className="palace-overline">تعرّف على الطريق</p>
                  <h3>
                    {locus.number === 1
                      ? "ابدأ عند الباب."
                      : locus.number === 5
                        ? "هنا تنتهي جولتك."
                        : "امنح هذا المكان لحظة."}
                  </h3>
                  <p>
                    لاحظ {locus.cue}. سيبقى هذا المكان ثابتًا عندما تربط به
                    معلومة وتعود لاختبارها.
                  </p>
                  <div className="palace-tour-actions">
                    {locus.number > 1 && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => choose(LOCI[locus.number - 2].id)}
                      >
                        <ArrowRight size={16} />
                        السابق
                      </button>
                    )}
                    {locus.number < 5 ? (
                      <button
                        className="btn btn-primary"
                        onClick={() =>
                          choose(LOCI[locus.number as number]?.id ?? "library")
                        }
                      >
                        المكان التالي <ArrowLeft size={16} />
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setMode("explore");
                          setNotice(
                            "اكتملت جولتك. اربط معلومة بكل مكان، أو اختبر ترتيب الطريق أولًا.",
                          );
                        }}
                      >
                        أنهِ الجولة <Check size={16} />
                      </button>
                    )}
                  </div>
                  <button
                    className="palace-text-button"
                    onClick={() => setMode("explore")}
                  >
                    العودة للاستكشاف
                  </button>
                </div>
              ) : (
                <div className="palace-association">
                  {association ? (
                    <>
                      <div className="palace-section-top">
                        <h3>رابطك في هذا المكان</h3>
                        <button
                          className="palace-icon-button"
                          aria-label={`تعديل رابط ${locus.name}`}
                          onClick={openEditor}
                        >
                          <Pencil size={17} />
                        </button>
                      </div>
                      <p className="palace-fact">{association.fact}</p>
                      <div className="palace-mnemonic">
                        <span>الصورة الذهنية</span>
                        <p>{association.image}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="palace-association-empty-icon">
                        <Plus size={20} />
                      </span>
                      <h3>ما الذي تريد تذكّره هنا؟</h3>
                      <p>
                        اختر معلومة واحدة، وتخيّل لها مشهدًا غريبًا وواضحًا في هذا
                        المكان.
                      </p>
                      <button className="btn btn-primary" onClick={openEditor}>
                        <Plus size={16} />
                        أضف رابطًا ذهنيًا
                      </button>
                    </>
                  )}
                </div>
              )}
            </aside>
          </section>

          <section
            className="palace-practice-panel"
            aria-labelledby="palace-practice-title"
          >
            <div className="palace-practice-heading">
              <span className="palace-practice-icon">
                <EyeOff size={23} />
              </span>
              <div>
                <p className="palace-overline">الاسترجاع قبل الكشف</p>
                <h2 id="palace-practice-title">والآن… ماذا تتذكّر؟</h2>
                <p>
                  أخفِ الروابط، ومرّ بالمواقع بالترتيب. التقييم الذاتي يبقى تقييمًا
                  ذاتيًا.
                </p>
              </div>
            </div>
            <div className="palace-practice-actions">
              <span className="palace-link-count">
                {associations.length} / ٥ روابط محفوظة
              </span>
              <button
                className="btn btn-primary"
                disabled={pending || associations.length === 0}
                onClick={() => start("concept")}
              >
                ابدأ استرجاع المعلومات <ArrowLeft size={16} />
              </button>
              <button
                className="palace-text-button"
                disabled={pending}
                onClick={() => start("route")}
              >
                اختبر ترتيب الطريق فقط
              </button>
            </div>
          </section>

          <div className="palace-bottom-grid">
            <section className="palace-method-note">
              <BookOpen size={22} />
              <div>
                <h3>كيف أصنع رابطًا مفيدًا؟</h3>
                <p>
                  تخيّل المعلومة وهي تتفاعل مع المكان. الصورة الذهنية تذكّرك
                  بالمعلومة؛ الاختبار يكشف ما استرجعته فعلًا. هذه أداة للتدريب،
                  ولا تضمن تحسّنًا محددًا.
                </p>
                {associations.length === 0 && (
                  <button
                    className="palace-text-button"
                    onClick={() => setConfirmExamples(true)}
                  >
                    جرّب خمس معلومات تعليمية في الأحياء <ArrowLeft size={14} />
                  </button>
                )}
              </div>
            </section>
            <section className="palace-history">
              <div className="palace-section-top">
                <h3>زياراتك السابقة</h3>
                <span className="palace-history-count">{completed.length}</span>
              </div>
              {completed.length ? (
                <ul>
                  {completed.slice(0, 3).map((item) => {
                    const summary = trialSummary(item);
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => {
                            setLocalTrial(item);
                            setMode("results");
                          }}
                        >
                          <span>
                            {item.kind === "route"
                              ? "ترتيب الطريق"
                              : "استرجاع المعلومات"}
                            <small>
                              {formatDate(
                                item.completedAt ?? item.createdAt,
                                timezone,
                              )}
                            </small>
                          </span>
                          <span
                            title={
                              item.kind === "route"
                                ? "اختيارات صحيحة من الإجابات المسجلة"
                                : "تذكّر واضح من الإجابات المقيمة ذاتيًا"
                            }
                          >
                            {item.kind === "concept" && <small>بتقييمك</small>}
                            {summary.recalled}/{summary.answered}
                            <ChevronLeft size={15} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted">
                  بعد أول اختبار محفوظ، ستظهر زيارتك هنا. المقارنة تحتاج
                  محاولتين فعليتين على الأقل.
                </p>
              )}
            </section>
          </div>
        </>
      )}

      {mode === "trial" && trial && (
        <section className="palace-test" aria-label="اختبار الاسترجاع">
          <div className="palace-test-top">
            <button
              className="palace-text-button"
              onClick={() => setMode("explore")}
            >
              <ArrowRight size={16} />
              حفظ ومغادرة
            </button>
            <span className="palace-blind-label">
              <EyeOff size={15} />
              {trial.kind === "route"
                ? "اختبار ترتيب الطريق"
                : "الروابط مخفية الآن"}
            </span>
          </div>
          <div
            className="palace-test-progress"
            aria-label={`الموقع ${trialIndex + 1} من ${ids.length}`}
          >
            {ids.map((id, i) => (
              <span
                key={id}
                className={`${i === trialIndex ? "is-current" : ""} ${trial.results.some((result) => result.locusId === id && (result.rating || result.skipped)) ? "is-done" : ""}`}
              />
            ))}
          </div>
          <div className="palace-test-body">
            {trial.kind === "concept" && currentLocus && (
              <div className="palace-test-scene">
                <PalaceScene locusId={currentLocus.id} />
              </div>
            )}
            {trial.kind === "route" && (
              <div className="palace-route-test-icon">
                <Footprints size={46} strokeWidth={1.2} />
              </div>
            )}
            <p className="palace-overline">
              {trial.kind === "concept"
                ? `المكان ${trialIndex + 1} من ${ids.length}`
                : `الخطوة ${trialIndex + 1} من ٥`}
            </p>
            <h2>
              {trial.kind === "route"
                ? "أين تكون في هذه الخطوة؟"
                : `ما المعلومة التي ربطتها بـ${currentLocus?.name ?? "هذا المكان"}؟`}
            </h2>
            {!currentResult && (
              <>
                <p className="muted">
                  {trial.kind === "route"
                    ? "تخيّل طريقك من البداية، ثم اختر المكان. الخريطة مخفية أثناء الاختبار."
                    : "استرجع الفكرة قبل كشفها. لا نستخدم AI لتقييم نصّك."}
                </p>
                {trial.kind === "route" ? (
                  <div className="palace-route-choices">
                    {[LOCI[4], LOCI[0], LOCI[3], LOCI[1], LOCI[2]].map(
                      (choice) => (
                        <button
                          className={`palace-choice ${response === choice.id ? "is-selected" : ""}`}
                          key={choice.id}
                          onClick={() => setResponse(choice.id)}
                          aria-pressed={response === choice.id}
                          disabled={pending}
                        >
                          {choice.name}
                        </button>
                      ),
                    )}
                  </div>
                ) : (
                  <label className="palace-recall-field">
                    محاولتك
                    <textarea
                      value={response}
                      onChange={(event) => setResponse(event.target.value)}
                      placeholder="اكتب ما تتذكّره، ولو كان جزءًا من الفكرة…"
                      rows={4}
                      maxLength={4000}
                    />
                  </label>
                )}
                <button
                  className="btn btn-primary palace-submit"
                  disabled={pending || !response.trim()}
                  onClick={() => trialAction("submit", { response })}
                >
                  {pending ? "جارٍ الحفظ…" : "احفظ محاولتي"}
                  <Check size={16} />
                </button>
                <div className="palace-test-secondary">
                  {trial.kind === "concept" && (
                    <button
                      className="palace-text-button"
                      disabled={pending}
                      onClick={cannotRecall}
                    >
                      لا أتذكّر، أكشف الإجابة
                    </button>
                  )}
                  <button
                    className="palace-text-button"
                    disabled={pending}
                    onClick={() => trialAction("skip")}
                  >
                    تخطّ هذا الموقع
                  </button>
                </div>
              </>
            )}
            {currentResult && !currentResult.skipped && (
              <>
                <div className="palace-saved-response">
                  <span>
                    <Check size={14} />
                    محاولتك محفوظة
                  </span>
                  <p>
                    {trial.kind === "route"
                      ? (getLocus(currentResult.response)?.name ??
                        currentResult.response)
                      : currentResult.response || "لم تسجّل استرجاعًا قبل الكشف."}
                  </p>
                </div>
                {!currentResult.revealed && (
                  <button
                    className="btn btn-primary"
                    disabled={pending}
                    onClick={() => trialAction("reveal")}
                  >
                    <Eye size={16} />
                    اكشف المعلومة للمقارنة
                  </button>
                )}
                {currentResult.revealed && (
                  <div className="palace-answer">
                    <span>
                      {trial.kind === "route"
                        ? "المكان الصحيح"
                        : "المعلومة المرتبطة وقت بدء الاختبار"}
                    </span>
                    <p>{currentResult.modelAnswer}</p>
                  </div>
                )}
                {currentResult.revealed && !currentResult.rating && (
                  <div className="palace-self-grade">
                    <h3>قارن الفكرة، ثم قيّم استرجاعك بنفسك.</h3>
                    <p>هذا تقييمك الشخصي، وليس تصحيحًا آليًا لفهمك.</p>
                    <div>
                      {(["again", "hard", "good"] as Rating[]).map((rating) => (
                        <button
                          className={`palace-rating palace-rating-${rating}`}
                          key={rating}
                          disabled={pending}
                          onClick={() => trialAction("rate", { rating })}
                        >
                          {RATING_LABELS[rating]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {currentResult.rating && (
                  <p className="palace-rating-saved" role="status">
                    <Check size={17} />
                    {trial.kind === "route"
                      ? currentResult.rating === "good"
                        ? "اختيار صحيح، محفوظ."
                        : "اختيار غير صحيح، محفوظ. يمكنك التدرّب مجددًا."
                      : `حُفظ تقييمك الذاتي: ${RATING_LABELS[currentResult.rating]}`}
                  </p>
                )}
              </>
            )}
            {currentResult?.skipped && (
              <div className="palace-skipped">
                <Footprints size={25} />
                <h3>تم تخطّي هذا الموقع.</h3>
                <p>سُجّل كتخطٍّ، ولم يُحسب إجابة صحيحة أو خاطئة.</p>
              </div>
            )}
            {(currentResult?.rating || currentResult?.skipped) &&
              trialIndex < ids.length - 1 && (
                <button className="btn btn-primary" onClick={nextLocus}>
                  الموقع التالي <ArrowLeft size={16} />
                </button>
              )}
            {trialDone && trialIndex === ids.length - 1 && (
              <div className="palace-schedule">
                <CalendarDays size={23} />
                <h3>اجعل لهذه المعلومات زيارة أخرى.</h3>
                <p>
                  جدول واضح وبسيط: اليوم التالي افتراضيًا. يمكنك تغيير الموعد.
                </p>
                <div className="palace-day-options">
                  {[1, 3, 7].map((days) => (
                    <button
                      key={days}
                      className="btn btn-secondary"
                      disabled={pending}
                      onClick={() => {
                        setRetestAt(futureDate(days));
                        setCustomDate("");
                      }}
                    >
                      {days === 1 ? "بعد يوم" : `بعد ${days} أيام`}
                    </button>
                  ))}
                </div>
                <label className="palace-custom-date">
                  أو اختر تاريخًا{" "}
                  <input
                    type="date"
                    value={customDate}
                    onChange={(event) => {
                      setCustomDate(event.target.value);
                      if (event.target.value)
                        setRetestAt(dateAtNine(event.target.value, timezone));
                    }}
                  />
                </label>
                <p className="palace-date-preview">
                  الزيارة التالية:{" "}
                  <strong>{formatDate(retestAt, timezone)}</strong>
                  <small>
                    {timezone} · قاعدة ثابتة قابلة للتعديل، وليست AI.
                  </small>
                </p>
                <button
                  className="btn btn-primary"
                  disabled={pending}
                  onClick={finish}
                >
                  {pending ? "جارٍ الحفظ…" : "أنهِ الاختبار واحفظ المراجعة"}
                  <Check size={16} />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {mode === "results" && trial && (
        <PalaceResults
          trial={trial}
          timezone={timezone}
          onBack={() => setMode("explore")}
          onRepeat={() => start(trial.kind)}
          pending={pending}
        />
      )}

      {editor && (
        <div
          className="palace-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && !pending)
              setEditor(false);
          }}
        >
          <section
            className="palace-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="palace-editor-title"
            onKeyDown={(event) => {
              if (event.key === "Escape" && !pending) setEditor(false);
            }}
          >
            <button
              className="palace-modal-close"
              aria-label="إغلاق"
              onClick={() => setEditor(false)}
            >
              <X size={20} />
            </button>
            <p className="palace-overline">
              المكان {locus.number} · {locus.name}
            </p>
            <h2 id="palace-editor-title">اصنع صورةً تتذكّرها.</h2>
            <p className="muted">
              المعلومة شيء، والصورة التي تذكّرك بها شيء آخر. سيُخفى الاثنان أثناء
              الاختبار.
            </p>
            <form onSubmit={saveAssociation}>
              <label className="field">
                المعلومة التي أريد تذكّرها
                <textarea
                  autoFocus
                  required
                  value={fact}
                  onChange={(event) => setFact(event.target.value)}
                  rows={3}
                  maxLength={3000}
                  placeholder="معلومة واحدة، بلغتك وبوضوح…"
                />
              </label>
              <label className="field">
                الصورة الذهنية أو القصة
                <textarea
                  required
                  value={image}
                  onChange={(event) => setImage(event.target.value)}
                  rows={3}
                  maxLength={3000}
                  placeholder={`تخيّل المعلومة وهي تتفاعل مع ${locus.name}…`}
                />
              </label>
              {error && (
                <p className="palace-inline-error" role="alert">
                  {error}
                </p>
              )}
              <div className="palace-editor-actions">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={pending || !fact.trim() || !image.trim()}
                >
                  {pending ? "جارٍ الحفظ…" : "احفظ الرابط"}
                  <Check size={16} />
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setEditor(false)}
                  disabled={pending}
                >
                  إلغاء
                </button>
                {association && (
                  <button
                    className="palace-text-button palace-delete-button"
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={pending}
                  >
                    <Trash2 size={15} />
                    حذف الرابط
                  </button>
                )}
              </div>
              {confirmDelete && (
                <div className="palace-delete-confirm">
                  <p>حذف هذا الرابط؟ ستبقى نتائج الاختبارات السابقة محفوظة.</p>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        await action("/api/palace", {
                          action: "delete-association",
                          locusId: selected,
                        });
                        setEditor(false);
                        setNotice("حُذف الرابط.");
                      })
                    }
                  >
                    نعم، احذف الرابط
                  </button>
                </div>
              )}
            </form>
          </section>
        </div>
      )}

      {confirmExamples && (
        <div className="palace-modal-backdrop">
          <section
            className="palace-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="palace-examples-title"
          >
            <button
              className="palace-modal-close"
              aria-label="إغلاق"
              onClick={() => setConfirmExamples(false)}
            >
              <X size={20} />
            </button>
            <p className="palace-overline">مثال تعليمي أصلي</p>
            <h2 id="palace-examples-title">تجوّل داخل خلية… في بيتك.</h2>
            <p>
              سنحفظ خمس معلومات مبسّطة عن الخلية، مع صور ذهنية قابلة للتعديل. هذه
              أمثلة للتعلّم وليست تغطية لمنهجك الجامعي.
            </p>
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  for (const example of EXAMPLE_ASSOCIATIONS)
                    await action("/api/palace", {
                      action: "save-association",
                      ...example,
                    });
                  setConfirmExamples(false);
                  setNotice(
                    "حُفظت الأمثلة الخمسة. استكشف الروابط قبل اختبارها، ويمكنك تعديل أي منها.",
                  );
                })
              }
            >
              {pending ? "جارٍ حفظ الأمثلة…" : "استخدم الأمثلة الخمسة"}
              <ArrowLeft size={16} />
            </button>
            {error && <p role="alert">{error}</p>}
          </section>
        </div>
      )}
    </div>
  );
}

function PalaceResults({
  trial,
  timezone,
  onBack,
  onRepeat,
  pending,
}: {
  trial: PalaceTrial;
  timezone: string;
  onBack: () => void;
  onRepeat: () => void;
  pending: boolean;
}) {
  const summary = trialSummary(trial);
  return (
    <section className="palace-results">
      <span className="palace-results-icon">
        <Footprints size={34} strokeWidth={1.4} />
      </span>
      <p className="palace-overline">
        زيارة محفوظة ·{" "}
        {trial.kind === "route" ? "اختبار ترتيب الطريق" : "استرجاع المعلومات"}
      </p>
      <h2>خطوات صغيرة، وذاكرة تُختبَر.</h2>
      <p className="muted">
        {trial.kind === "route"
          ? "هذه نتائج اختياراتك لترتيب الأماكن، وليست قياسًا لتذكّر المعلومات."
          : "هذه نتائج تقييمك الذاتي بعد المقارنة، وليست تصحيحًا آليًا لفهمك."}
      </p>
      <div className="palace-result-metrics">
        <div>
          <strong>
            {summary.recalled}
            <small>/{summary.answered}</small>
          </strong>
          <span>
            {trial.kind === "route" ? "اختيارات صحيحة" : "تذكّرت بوضوح"}
          </span>
        </div>
        {trial.kind === "concept" && (
          <div>
            <strong>{summary.partial}</strong>
            <span>تذكّر جزئي، بتقييمك</span>
          </div>
        )}
        <div>
          <strong>{summary.skipped}</strong>
          <span>مواقع متخطّاة</span>
        </div>
      </div>
      <p className="palace-result-caveat">
        المقام يشمل المواقع التي أُجيب عنها وقُيّمت فقط. لا يُحتسب التخطي كإجابة
        خاطئة. هذه المحاولة وحدها لا تثبت تحسّن الذاكرة.
      </p>
      <div className="palace-result-list">
        {trial.results.map((result, i) => (
          <div key={result.locusId}>
            <span className="palace-result-locus">
              {trial.kind === "route"
                ? `الخطوة ${i + 1}`
                : (getLocus(result.locusId)?.name ?? result.locusId)}
            </span>
            <span
              className={`palace-result-rating ${result.skipped ? "is-skipped" : ""}`}
            >
              {result.skipped
                ? "متخطّى"
                : trial.kind === "route"
                  ? result.rating === "good"
                    ? "صحيح"
                    : "غير صحيح"
                  : result.rating
                    ? RATING_LABELS[result.rating]
                    : "غير مقيّم"}
            </span>
          </div>
        ))}
      </div>
      {trial.dueAt && (
        <div className="palace-result-review">
          <CalendarDays size={21} />
          <div>
            <strong>زيارتك التالية محفوظة.</strong>
            <p>
              {formatDate(trial.dueAt, timezone)} · {timezone}
            </p>
            <small>ستجدها في المراجعات، ويمكنك تعديل موعدها هناك.</small>
          </div>
        </div>
      )}
      <div className="palace-results-actions">
        <button className="btn btn-primary" onClick={onBack}>
          العودة إلى قصري <House size={16} />
        </button>
        <button
          className="btn btn-secondary"
          disabled={pending}
          onClick={onRepeat}
        >
          <RotateCcw size={16} />
          محاولة جديدة
        </button>
      </div>
    </section>
  );
}
