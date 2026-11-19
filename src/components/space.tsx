"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowUpLeft,
  Check,
  ChevronLeft,
  Clock3,
  Coffee,
  FileText,
  Flag,
  Folder,
  Headphones,
  Leaf,
  LoaderCircle,
  Mic,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Square,
  Star,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import type {
  Goal,
  Habit,
  Note,
  Project,
  StudySession,
  Task,
  VoiceAsset,
} from "@/lib/types";
import "./space.css";
import { EvolutionEntry } from "./evolution/entry";

type Section = "notes" | "tasks" | "habits" | "goals" | "timer" | "journal";
type ModalKind = "note" | "task" | "project" | "habit" | "goal" | null;
const tabs: {
  id: Section;
  label: string;
  icon: typeof FileText;
  href: string;
}[] = [
  { id: "notes", label: "أفكاري", icon: FileText, href: "/space" },
  { id: "tasks", label: "ما يهمّني", icon: Flag, href: "/space/tasks" },
  { id: "habits", label: "عاداتي", icon: Leaf, href: "/space/habits" },
  { id: "goals", label: "أهدافي", icon: Target, href: "/space/goals" },
  { id: "timer", label: "وقت هادئ", icon: Coffee, href: "/space/timer" },
  { id: "journal", label: "يوميّاتي", icon: Pencil, href: "/space/journal" },
];

function localDate(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)?.value)
    .join("-");
}
function offsetDate(date: string, offset: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
function humanDate(date: string, timezone: string, includeYear = false) {
  return new Intl.DateTimeFormat("ar", {
    timeZone: date.length === 10 ? "UTC" : timezone,
    day: "numeric",
    month: "long",
    year: includeYear ? "numeric" : undefined,
  }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date));
}
function Dialog({
  title,
  children,
  close,
  notice,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  notice?: { message: string; error: boolean } | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className="space-dialog"
      aria-label={title}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="space-dialog-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="space-icon-button"
          aria-label="إغلاق"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {notice && (
        <div
          className={`space-notice ${notice.error ? "error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.message}
        </div>
      )}
      {children}
    </dialog>
  );
}

export default function SpacePage({ section = [] }: { section?: string[] }) {
  const { state, loading, create, update, remove, refresh, savePreferences } =
    useApp();
  const current: Section = tabs.some((t) => t.id === section[0])
    ? (section[0] as Section)
    : "notes";
  const [modal, setModal] = useState<ModalKind>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<{
    collection: "notes" | "tasks" | "habits" | "goals" | "projects";
    id: string;
    title: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"open" | "all" | "done">("open");
  const [pendingTasks, setPendingTasks] = useState<Record<string, boolean>>({});
  const [habitDay, setHabitDay] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");

  const timezone = state?.preferences.timezone || "Asia/Hebron";
  const today = localDate(timezone);
  const selectedDay = habitDay || today;
  const notes = useMemo(
    () =>
      (state?.notes || [])
        .filter(
          (n) =>
            Boolean(n.journal) === (current === "journal") &&
            Boolean(n.archived) === archived &&
            (!query || `${n.title} ${n.text}`.includes(query)),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [state?.notes, current, archived, query],
  );
  const tasks = useMemo(
    () =>
      (state?.tasks || [])
        .filter(
          (t) =>
            taskFilter === "all" || (taskFilter === "done" ? t.done : !t.done),
        )
        .sort(
          (a, b) =>
            Number(a.done) - Number(b.done) ||
            b.importance - a.importance ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [state?.tasks, taskFilter],
  );

  useEffect(() => {
    setQuery("");
    setArchived(false);
    setNotice(null);
  }, [current]);
  useEffect(() => {
    if (
      (section[0] === "notes" || section[0] === "journal") &&
      section[1] &&
      state
    ) {
      const note = state.notes.find((n) => n.id === section[1]);
      if (note) {
        setEditingNote(note);
        setNoteTitle(note.title);
        setNoteText(note.text);
        setModal("note");
      }
    }
    if (section[0] === "tasks" && section[1] && state) {
      const task = state.tasks.find((t) => t.id === section[1]);
      if (task) {
        setEditingTask(task);
        setModal("task");
      }
    }
    // Only open a deep-linked note when its identity changes, not after every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section[0], section[1], Boolean(state)]);

  async function run(work: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setNotice(null);
    try {
      await work();
      if (success) setNotice({ message: success, error: false });
      return true;
    } catch (e) {
      setNotice({
        message: e instanceof Error ? e.message : "تعذّر الحفظ. حاول مرة أخرى.",
        error: true,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  function newNote() {
    setEditingNote(null);
    setNoteTitle("");
    setNoteText("");
    setModal("note");
  }
  function editNote(note: Note) {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteText(note.text);
    setModal("note");
  }
  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    const values = {
      title: noteTitle.trim() || noteText.trim().split("\n")[0].slice(0, 70),
      text: noteText.trim(),
      journal: editingNote
        ? Boolean(editingNote.journal)
        : current === "journal",
      archived: editingNote?.archived || false,
    };
    const ok = await run(
      () =>
        editingNote
          ? update("notes", editingNote.id, values)
          : create("notes", values),
      "حُفظت كلماتك. تبقى ملاحظة، كما هي.",
    );
    if (ok) {
      setModal(null);
      setNoteText("");
      setNoteTitle("");
    }
  }
  async function convert(note: Note) {
    await run(
      () =>
        create("tasks", {
          title: note.title || note.text.slice(0, 70),
          importance: 2,
          done: false,
          priority: false,
          noteId: note.id,
        }),
      "أنشأتَ مهمة مرتبطة. بقيت الملاحظة الأصلية محفوظة.",
    );
  }
  async function saveTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const timeBlock =
      data.get("timeBlockEnabled") === "on"
        ? {
            date: String(data.get("timeBlockDate") || ""),
            start: String(data.get("timeBlockStart") || ""),
            end: String(data.get("timeBlockEnd") || ""),
            timezone: String(data.get("timeBlockTimezone") || ""),
          }
        : null;
    const values = {
      timeBlock,
      title: String(data.get("title") || "").trim(),
      importance: Number(data.get("importance")),
      dueDate: String(data.get("dueDate") || ""),
      projectId: String(data.get("projectId") || ""),
      done: editingTask?.done || false,
      priority: editingTask?.priority || false,
    };
    if (!values.title) return;
    const ok = await run(
      () =>
        editingTask
          ? update("tasks", editingTask.id, values)
          : create("tasks", values),
      "حُفظت المهمة.",
    );
    if (ok) setModal(null);
  }
  async function saveProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") || "").trim();
    const stages = String(data.get("stages") || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!title || !stages.length) return;
    const ok = await run(
      () => create("projects", { title, stages, stage: 0 }),
      "حُفظ المشروع بمراحله التي اخترتها.",
    );
    if (ok) setModal(null);
  }
  async function saveSimple(
    e: React.FormEvent<HTMLFormElement>,
    type: "habits" | "goals",
  ) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    const ok = await run(
      () =>
        create(
          type,
          type === "habits"
            ? { title, logs: {} }
            : { title, target: String(data.get("target") || ""), progress: 0 },
        ),
      type === "habits"
        ? "أضيفت العادة. الراحة جزء من المساحة."
        : "حُفظ الهدف. حدّد تقدّمك بالطريقة التي تناسبك.",
    );
    if (ok) setModal(null);
  }
  async function logHabit(
    habit: Habit,
    value: "done" | "rest" | "skipped" | null,
  ) {
    const logs = { ...habit.logs };
    if (value) logs[selectedDay] = value;
    else delete logs[selectedDay];
    await run(() => update("habits", habit.id, { logs }));
  }
  async function toggleTask(task: Task) {
    setPendingTasks((previous) => ({ ...previous, [task.id]: !task.done }));
    await run(() => update("tasks", task.id, { done: !task.done }));
    setPendingTasks((previous) => {
      const next = { ...previous };
      delete next[task.id];
      return next;
    });
  }
  async function togglePriority(task: Task) {
    if (
      !task.priority &&
      (state?.tasks.filter((t) => t.priority && !t.done).length || 0) >= 3
    ) {
      setNotice({
        message: "اختر حتى ثلاث أولويات. يمكنك تغيير واحدة قبل إضافة أخرى.",
        error: true,
      });
      return;
    }
    await run(() => update("tasks", task.id, { priority: !task.priority }));
  }

  if (loading || !state)
    return (
      <div className="space-page">
        <div className="space-skeleton" aria-label="جارٍ تحميل مساحتك" />
        <div className="space-skeleton small" />
      </div>
    );

  const title =
    current === "tasks"
      ? "مساحة لما يهمّك."
      : current === "habits"
        ? "خطوات صغيرة، بإيقاعك."
        : current === "goals"
          ? "وجهة تختارها أنت."
          : current === "timer"
            ? "بعض الوقت، لنفسك."
            : current === "journal"
              ? "كلمات لك وحدك."
              : "اترك للفكرة مكانًا.";
  const description =
    current === "tasks"
      ? "رتّب حسب الأهمية. الموعد يذكّرك، ولا يختار أولويتك."
      : current === "habits"
        ? "أنجز، أو استرح، أو تجاوز اليوم. يمكنك دائمًا تصحيح السجل."
        : current === "goals"
          ? "هدفان أو ثلاثة يكفون للبداية. هذا تقدّم تسجّله أنت، وليس حكمًا عليك."
          : current === "timer"
            ? "مؤقّت هادئ بلا ضغوط. ابدأ، توقّف، وعد حين يناسبك."
            : current === "journal"
              ? "يوميّات اختيارية، منفصلة عن استنتاجات التعلّم وAI."
              : "فكرة، جملة، أو شيء لا تريد نسيانه. ليس عليها أن تصبح مهمة.";

  return (
    <div className="space-page">
      <header className="space-header">
        <div>
          <p className="eyebrow">
            مساحتي <span aria-hidden="true">/</span> مساحة تتّسع لك
          </p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="space-header-flower" aria-hidden="true">
          <Leaf size={45} strokeWidth={1} />
        </div>
      </header>
      <EvolutionEntry variant="space" />
      <nav className="space-tabs" aria-label="أقسام مساحتي">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={current === tab.id ? "active" : ""}
            aria-current={current === tab.id ? "page" : undefined}
          >
            <tab.icon size={17} />
            <span>{tab.label}</span>
          </Link>
        ))}
      </nav>
      {notice && (
        <div
          className={`space-notice ${notice.error ? "error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            aria-label="إغلاق الرسالة"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {(current === "notes" || current === "journal") && (
        <>
          {current === "journal" && !state.preferences.journalEnabled ? (
            <div className="space-journal-optin">
              <Pencil size={38} strokeWidth={1} />
              <h2>إن أحببت أن تكتب لنفسك.</h2>
              <p>
                اليوميّات اختيارية. كلماتك خاصة، ولا تُستخدم في التحليل أو التخصيص
                افتراضيًا.
              </p>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  run(
                    () => savePreferences({ journalEnabled: true }),
                    "فُعّلت يوميّاتك الاختيارية.",
                  )
                }
              >
                فعّل اليوميّات
              </button>
            </div>
          ) : (
            <>
              <div className="space-toolbar">
                <div className="space-search">
                  <Search size={17} />
                  <input
                    aria-label="ابحث في الملاحظات"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ابحث عن فكرة…"
                  />
                </div>
                <div className="space-toolbar-actions">
                  <button
                    className={`space-filter ${archived ? "active" : ""}`}
                    onClick={() => setArchived(!archived)}
                  >
                    <Archive size={16} />
                    {archived ? "عرض المحفوظات" : "الأرشيف"}
                  </button>
                  <button className="btn btn-primary" onClick={newNote}>
                    <Plus size={17} />
                    {current === "journal" ? "اكتب لنفسك" : "فكرة جديدة"}
                  </button>
                </div>
              </div>
              {notes.length === 0 ? (
                <div className="space-notes-empty">
                  <div className="space-paper" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <h2>
                    {query
                      ? "لم نجد هذه الكلمات."
                      : archived
                        ? "الأرشيف هادئ الآن."
                        : current === "journal"
                          ? "صفحة بيضاء، بلا توقعات."
                          : "أول فكرة لا تحتاج عنوانًا."}
                  </h2>
                  <p>
                    {query
                      ? "جرّب كلمة أخرى، أو عد إلى كل الملاحظات."
                      : archived
                        ? "ستجد هنا ما تختار أرشفته."
                        : "اكتبها كما جاءت. يمكنك ترتيبها لاحقًا."}
                  </p>
                  {!query && !archived && (
                    <button className="space-text-button" onClick={newNote}>
                      ابدأ الكتابة <ArrowUpLeft size={18} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-note-grid">
                  {notes.map((note, index) => (
                    <article
                      className={`space-note space-note-${index % 3}`}
                      key={note.id}
                    >
                      <button
                        className="space-note-open"
                        onClick={() => editNote(note)}
                        aria-label={`فتح ${note.title}`}
                      >
                        <span className="space-note-date">
                          {humanDate(note.updatedAt, timezone)}
                        </span>
                        <h2>{note.title}</h2>
                        <p>{note.text}</p>
                      </button>
                      <div className="space-note-footer">
                        <span>
                          {note.journal ? "يوميّات خاصة" : "فكرة محفوظة"}
                        </span>
                        <div>
                          <button
                            className="space-icon-button"
                            title={note.archived ? "إلغاء الأرشفة" : "أرشفة"}
                            aria-label={
                              note.archived
                                ? "إلغاء أرشفة الملاحظة"
                                : "أرشفة الملاحظة"
                            }
                            disabled={busy}
                            onClick={() =>
                              run(() =>
                                update("notes", note.id, {
                                  archived: !note.archived,
                                }),
                              )
                            }
                          >
                            <Archive size={16} />
                          </button>
                          <button
                            className="space-icon-button danger"
                            aria-label="حذف الملاحظة"
                            disabled={busy}
                            onClick={() =>
                              setDeleting({
                                collection: "notes",
                                id: note.id,
                                title: note.title,
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {current === "notes" && (
                <VoiceRecorder
                  assets={state.voiceAssets}
                  refresh={refresh}
                  notify={(message, error = false) =>
                    setNotice({ message, error })
                  }
                />
              )}
            </>
          )}
        </>
      )}

      {current === "tasks" && (
        <>
          <div className="space-toolbar">
            <div className="space-segment" aria-label="تصفية المهام">
              {(["open", "all", "done"] as const).map((f) => (
                <button
                  key={f}
                  className={taskFilter === f ? "active" : ""}
                  onClick={() => setTaskFilter(f)}
                >
                  {f === "open" ? "الحالية" : f === "all" ? "الكل" : "المنجزة"}
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingTask(null);
                setModal("task");
              }}
            >
              <Plus size={17} />
              أضف مهمة
            </button>
          </div>
          {!tasks.length ? (
            <div className="space-empty-inline">
              <Flag size={28} strokeWidth={1} />
              <h2>لا شيء هنا يحتاج انتباهك الآن.</h2>
              <p>أضف مهمة عندما يكون لديك شيء مهم. لا حاجة لملء القائمة.</p>
            </div>
          ) : (
            <div className="space-task-list">
              {tasks.map((task) => (
                <article
                  className={`space-task ${task.done ? "done" : ""}`}
                  key={task.id}
                >
                  <label className="space-task-check">
                    <input
                      type="checkbox"
                      checked={pendingTasks[task.id] ?? task.done}
                      disabled={busy}
                      onChange={() => toggleTask(task)}
                      aria-label={`إنجاز ${task.title}`}
                    />
                    <span aria-hidden="true">
                      {pendingTasks[task.id] !== undefined ? (
                        <LoaderCircle className="space-spin" size={13} />
                      ) : (
                        task.done && <Check size={14} />
                      )}
                    </span>
                  </label>
                  <div className="space-task-main">
                    <button
                      className="space-task-title"
                      onClick={() => {
                        setEditingTask(task);
                        setModal("task");
                      }}
                    >
                      {task.title}
                    </button>
                    <div className="space-task-meta">
                      <span
                        className={`space-importance importance-${task.importance}`}
                      >
                        {task.importance === 3
                          ? "أهمية عالية"
                          : task.importance === 2
                            ? "أهمية متوسطة"
                            : "أهمية منخفضة"}
                      </span>
                      {task.dueDate && (
                        <span>الموعد: {humanDate(task.dueDate, timezone)}</span>
                      )}
                      {task.projectId && (
                        <span>
                          <Folder size={12} />
                          {state.projects.find((p) => p.id === task.projectId)
                            ?.title || "مشروع"}
                        </span>
                      )}
                      {task.noteId && (
                        <Link href={`/space/notes/${task.noteId}`}>
                          الملاحظة الأصلية
                        </Link>
                      )}
                      {task.timeBlock && (
                        <span className="space-time-plan">
                          <Clock3 size={12} />
                          <span>
                            وقت مخطّط:{" "}
                            {humanDate(
                              task.timeBlock.date,
                              task.timeBlock.timezone,
                              true,
                            )}{" "}
                            <bdi>
                              {task.timeBlock.start}–{task.timeBlock.end}
                            </bdi>{" "}
                            · <bdi>{task.timeBlock.timezone}</bdi>
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className={`space-icon-button ${task.priority ? "starred" : ""}`}
                    title="إضافة إلى أولويات اليوم"
                    aria-label={
                      task.priority
                        ? "إزالة من أولويات اليوم"
                        : "إضافة إلى أولويات اليوم"
                    }
                    aria-pressed={Boolean(task.priority)}
                    disabled={busy}
                    onClick={() => togglePriority(task)}
                  >
                    <Star
                      size={17}
                      fill={task.priority ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    className="space-icon-button danger"
                    aria-label={`حذف ${task.title}`}
                    onClick={() =>
                      setDeleting({
                        collection: "tasks",
                        id: task.id,
                        title: task.title,
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
            </div>
          )}
          <section className="space-projects">
            <div className="space-section-title">
              <div>
                <p className="eyebrow">خطوة تتبعها خطوة</p>
                <h2>مشاريعك، بالمراحل التي تختارها.</h2>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setModal("project")}
              >
                <Plus size={16} />
                مشروع جديد
              </button>
            </div>
            {!state.projects.length ? (
              <p className="muted">
                أضف مشروعًا عندما تحتاجه؛ لن ننشئ مشاريع أو خطوات بالنيابة عنك.
              </p>
            ) : (
              <div className="space-project-grid">
                {state.projects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    tasks={state.tasks.filter(
                      (t) => t.projectId === project.id,
                    )}
                    busy={busy}
                    change={(stage) =>
                      run(() => update("projects", project.id, { stage }))
                    }
                    remove={() =>
                      setDeleting({
                        collection: "projects",
                        id: project.id,
                        title: project.title,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {current === "habits" && (
        <>
          <div className="space-toolbar">
            <label className="space-date-label">
              سجل يوم{" "}
              <input
                type="date"
                aria-label="اختر يوم سجل العادات"
                value={selectedDay}
                max={today}
                onChange={(e) => setHabitDay(e.target.value || today)}
              />
            </label>
            <button
              className="btn btn-primary"
              onClick={() => setModal("habit")}
              disabled={state.habits.length >= 3}
            >
              <Plus size={17} />
              عادة جديدة
            </button>
          </div>
          <div className="space-habit-calendar" aria-label="أيام سجل العادات">
            {Array.from({ length: 14 }, (_, i) =>
              offsetDate(today, i - 13),
            ).map((day) => (
              <button
                key={day}
                aria-label={humanDate(day, timezone)}
                aria-pressed={day === selectedDay}
                className={day === selectedDay ? "selected" : ""}
                onClick={() => setHabitDay(day)}
              >
                <span>
                  {new Intl.DateTimeFormat("ar", {
                    weekday: "short",
                    timeZone: "UTC",
                  }).format(new Date(`${day}T12:00:00Z`))}
                </span>
                <strong>{Number(day.slice(-2)).toLocaleString("ar")}</strong>
                <div className="space-calendar-dots">
                  {state.habits.map((h) => (
                    <i key={h.id} className={h.logs[day] || "unrecorded"} />
                  ))}
                </div>
              </button>
            ))}
          </div>
          {!state.habits.length ? (
            <div className="space-empty-inline">
              <Leaf size={32} strokeWidth={1} />
              <h2>عادة واحدة بداية كافية.</h2>
              <p>
                اختر ما يخدمك، ثم اترك مجالًا للراحة. يمكنك البدء بعادتين أو
                ثلاث.
              </p>
            </div>
          ) : (
            <div className="space-habit-list">
              {state.habits.map((habit) => (
                <article className="space-habit" key={habit.id}>
                  <div className="space-habit-heading">
                    <div>
                      <span className="space-habit-icon">
                        <Leaf size={20} />
                      </span>
                      <h2>{habit.title}</h2>
                    </div>
                    <button
                      className="space-icon-button danger"
                      aria-label={`حذف عادة ${habit.title}`}
                      onClick={() =>
                        setDeleting({
                          collection: "habits",
                          id: habit.id,
                          title: habit.title,
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="space-habit-actions">
                    {(
                      [
                        { id: "done", label: "أنجزت", icon: Check },
                        { id: "rest", label: "يوم راحة", icon: Coffee },
                        { id: "skipped", label: "تجاوزت", icon: ChevronLeft },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        disabled={busy}
                        aria-pressed={habit.logs[selectedDay] === item.id}
                        className={
                          habit.logs[selectedDay] === item.id
                            ? "selected " + item.id
                            : ""
                        }
                        onClick={() => logHabit(habit, item.id)}
                      >
                        <item.icon size={16} />
                        {item.label}
                      </button>
                    ))}
                    <button
                      className="space-icon-button"
                      aria-label="مسح تسجيل هذا اليوم"
                      title="بدون تسجيل"
                      disabled={busy || !habit.logs[selectedDay]}
                      onClick={() => logHabit(habit, null)}
                    >
                      <RotateCcw size={15} />
                    </button>
                  </div>
                  <p className="space-habit-status">
                    {habit.logs[selectedDay] === "done"
                      ? "سجّلت إنجازك لهذا اليوم."
                      : habit.logs[selectedDay] === "rest"
                        ? "راحة اخترتها. تبقى جزءًا من سجلّك."
                        : habit.logs[selectedDay] === "skipped"
                          ? "سجّلت تجاوز هذا اليوم. يمكنك تعديل اختيارك."
                          : "بدون تسجيل لهذا اليوم؛ لا نفترض ما حدث."}
                  </p>
                </article>
              ))}
            </div>
          )}
          <div className="space-kind-note">
            <Coffee size={19} />
            <p>يوم الراحة اختيار صالح. لا سلاسل تنكسر، ولا أيام نعدّها فشلًا.</p>
          </div>
        </>
      )}

      {current === "goals" && (
        <>
          <div className="space-toolbar">
            <p className="muted">
              {state.goals.length.toLocaleString("ar")} من ٣ أهداف تختارها أنت
            </p>
            <button
              className="btn btn-primary"
              disabled={state.goals.length >= 3}
              onClick={() => setModal("goal")}
            >
              <Plus size={17} />
              هدف جديد
            </button>
          </div>
          {!state.goals.length ? (
            <div className="space-empty-inline">
              <Target size={36} strokeWidth={1} />
              <h2>ما الذي يستحق مساحة في أيامك؟</h2>
              <p>ابدأ بهدف أو اثنين. اجعلهما واضحين، وقابلين للتعديل.</p>
            </div>
          ) : (
            <div className="space-goal-grid">
              {state.goals.map((goal, index) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  index={index}
                  busy={busy}
                  save={(progress) =>
                    run(
                      () => update("goals", goal.id, { progress }),
                      "حُفظ التقدّم الذي سجّلته.",
                    )
                  }
                  remove={() =>
                    setDeleting({
                      collection: "goals",
                      id: goal.id,
                      title: goal.title,
                    })
                  }
                />
              ))}
            </div>
          )}
          <p className="space-privacy-footnote">
            النسبة هنا تقييمك الشخصي للتقدّم، وليست نتيجة اختبار أو استنتاجًا عنك.
          </p>
        </>
      )}

      {current === "timer" && (
        <CalmTimer
          sessions={state.studySessions}
          busy={busy}
          run={run}
          create={(values) => create("studySessions", values)}
          update={(id, values) => update("studySessions", id, values)}
        />
      )}

      {modal === "note" && (
        <Dialog
          title={
            editingNote
              ? "مساحة لكلماتك"
              : current === "journal"
                ? "صفحة جديدة لك"
                : "فكرة جديدة"
          }
          close={() => setModal(null)}
          notice={notice}
        >
          <form onSubmit={saveNote}>
            <label className="field">
              العنوان <span className="muted">اختياري</span>
              <input
                value={noteTitle}
                maxLength={160}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="يمكن أن يأتي العنوان لاحقًا"
                autoFocus
              />
            </label>
            <label className="field">
              {current === "journal" ? "ما الذي تحب كتابته؟" : "الفكرة"}
              <textarea
                value={noteText}
                required
                maxLength={50000}
                onChange={(e) => setNoteText(e.target.value)}
                rows={9}
                placeholder="اكتب كما تفكّر…"
              />
            </label>
            <p className="space-privacy-footnote">
              خاصة بك. لا تُرسل إلى AI ولا تُستخدم للاستنتاجات افتراضيًا.
            </p>
            <div className="space-dialog-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || !noteText.trim()}
              >
                <Save size={16} />
                {busy ? "جارٍ الحفظ…" : "احفظ"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModal(null)}
              >
                إلغاء
              </button>
              {editingNote &&
                !editingNote.journal &&
                !state.tasks.some((t) => t.noteId === editingNote.id) && (
                  <button
                    type="button"
                    className="space-text-button"
                    disabled={busy}
                    onClick={() => convert(editingNote)}
                  >
                    <Flag size={16} />
                    أنشئ مهمة مرتبطة
                  </button>
                )}
            </div>
          </form>
        </Dialog>
      )}
      {modal === "task" && (
        <Dialog
          title={editingTask ? "تعديل المهمة" : "شيء يستحق الانتباه"}
          close={() => setModal(null)}
          notice={notice}
        >
          <form key={editingTask?.id || "new"} onSubmit={saveTask}>
            <label className="field">
              المهمة
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={editingTask?.title || ""}
                autoFocus
                placeholder="ما الذي تريد فعله؟"
              />
            </label>
            <div className="space-form-grid">
              <label className="field">
                الأهمية
                <select
                  name="importance"
                  defaultValue={editingTask?.importance || 2}
                >
                  <option value="3">عالية</option>
                  <option value="2">متوسطة</option>
                  <option value="1">منخفضة</option>
                </select>
              </label>
              <label className="field">
                موعد اختياري
                <input
                  type="date"
                  name="dueDate"
                  defaultValue={editingTask?.dueDate || ""}
                />
              </label>
            </div>
            <label className="field">
              مشروع اختياري
              <select
                name="projectId"
                defaultValue={editingTask?.projectId || ""}
              >
                <option value="">دون مشروع</option>
                {state.projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <TaskTimeBlockFields
              key={editingTask?.id || "new"}
              task={editingTask}
              timezone={timezone}
            />
            <div className="space-dialog-actions">
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "جارٍ الحفظ…" : "احفظ المهمة"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModal(null)}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "project" && (
        <Dialog
          title="مشروع تضيفه بنفسك"
          close={() => setModal(null)}
          notice={notice}
        >
          <form onSubmit={saveProject}>
            <label className="field">
              اسم المشروع
              <input name="title" required maxLength={200} autoFocus />
            </label>
            <label className="field">
              المراحل، كل مرحلة في سطر
              <textarea
                name="stages"
                required
                rows={5}
                defaultValue={"بداية\nتنفيذ\nمراجعة"}
                maxLength={2000}
              />
            </label>
            <p className="muted">
              عدّل المراحل قبل الحفظ؛ لا ننشئ مهام فرعية تلقائيًا.
            </p>
            <div className="space-dialog-actions">
              <button className="btn btn-primary" disabled={busy}>
                احفظ المشروع
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModal(null)}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {(modal === "habit" || modal === "goal") && (
        <Dialog
          title={modal === "habit" ? "عادة تناسب حياتك" : "وجهة تختارها"}
          close={() => setModal(null)}
          notice={notice}
        >
          <form
            onSubmit={(e) =>
              saveSimple(e, modal === "habit" ? "habits" : "goals")
            }
          >
            <label className="field">
              {modal === "habit" ? "اسم العادة" : "الهدف"}
              <input
                name="title"
                required
                maxLength={200}
                autoFocus
                placeholder={
                  modal === "habit"
                    ? "مثل: قراءة عشر دقائق"
                    : "ماذا تريد أن تحقق؟"
                }
              />
            </label>
            {modal === "goal" && (
              <label className="field">
                كيف تعرف أنك وصلت؟ <span className="muted">اختياري</span>
                <textarea
                  name="target"
                  rows={3}
                  maxLength={500}
                  placeholder="وصف بسيط يجعل الاتجاه أوضح"
                />
              </label>
            )}
            <div className="space-dialog-actions">
              <button className="btn btn-primary" disabled={busy}>
                احفظ
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModal(null)}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title="هل تريد الحذف؟"
          close={() => setDeleting(null)}
          notice={notice}
        >
          <p>
            سيُحذف «{deleting.title}» من مساحتك. لا يمكن التراجع عن هذا الإجراء.
          </p>
          <div className="space-dialog-actions">
            <button
              className="btn space-danger-button"
              disabled={busy}
              onClick={async () => {
                const ok = await run(
                  () => remove(deleting.collection, deleting.id),
                  "حُذف العنصر.",
                );
                if (ok) setDeleting(null);
              }}
            >
              <Trash2 size={16} />
              احذف
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setDeleting(null)}
            >
              احتفظ به
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function TaskTimeBlockFields({
  task,
  timezone,
}: {
  task: Task | null;
  timezone: string;
}) {
  const [enabled, setEnabled] = useState(Boolean(task?.timeBlock));
  const zone = task?.timeBlock?.timezone || timezone;
  return (
    <fieldset className="space-time-block">
      <legend>التخطيط بوقتك</legend>
      <label className="space-time-block-toggle">
        <input
          name="timeBlockEnabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        وقت اختياري
      </label>
      <p>مساحة تقترحها للمهمة؛ لا تغيّر أهميتها أو موعدها النهائي.</p>
      {enabled && (
        <>
          <div className="space-time-block-fields">
            <label className="field">
              يوم الوقت الاختياري
              <input
                type="date"
                name="timeBlockDate"
                required
                defaultValue={task?.timeBlock?.date || localDate(timezone)}
              />
            </label>
            <label className="field">
              من الساعة
              <input
                type="time"
                name="timeBlockStart"
                required
                step={60}
                defaultValue={task?.timeBlock?.start || "09:00"}
              />
            </label>
            <label className="field">
              إلى الساعة
              <input
                type="time"
                name="timeBlockEnd"
                required
                step={60}
                defaultValue={task?.timeBlock?.end || "10:00"}
              />
            </label>
          </div>
          <input type="hidden" name="timeBlockTimezone" value={zone} />
          <p>
            توقيت محلي محفوظ: <bdi>{zone}</bdi>. لا مزامنة تلقائية مع تقويم
            خارجي.
          </p>
        </>
      )}
    </fieldset>
  );
}

function ProjectRow({
  project,
  tasks,
  busy,
  change,
  remove,
}: {
  project: Project;
  tasks: Task[];
  busy: boolean;
  change: (stage: number) => Promise<unknown>;
  remove: () => void;
}) {
  return (
    <article className="space-project">
      <div className="space-project-top">
        <Folder size={21} strokeWidth={1.4} />
        <button
          className="space-icon-button danger"
          onClick={remove}
          aria-label={`حذف مشروع ${project.title}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <h3>{project.title}</h3>
      <label className="field">
        المرحلة الحالية
        <select
          disabled={busy}
          value={project.stage}
          onChange={(e) => change(Number(e.target.value))}
        >
          {project.stages.map((stage, i) => (
            <option key={i} value={i}>
              {stage}
            </option>
          ))}
        </select>
      </label>
      <div className="space-project-path" aria-hidden="true">
        {project.stages.map((_, i) => (
          <span key={i} className={i <= project.stage ? "current" : ""} />
        ))}
      </div>
      <p className="muted">
        {tasks.filter((t) => t.done).length.toLocaleString("ar")} /{" "}
        {tasks.length.toLocaleString("ar")} مهام منجزة
      </p>
    </article>
  );
}

function GoalRow({
  goal,
  index,
  busy,
  save,
  remove,
}: {
  goal: Goal;
  index: number;
  busy: boolean;
  save: (progress: number) => Promise<unknown>;
  remove: () => void;
}) {
  const [progress, setProgress] = useState(goal.progress);
  useEffect(() => setProgress(goal.progress), [goal.progress]);
  return (
    <article className="space-goal">
      <div className="space-goal-top">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <button
          className="space-icon-button danger"
          aria-label={`حذف هدف ${goal.title}`}
          onClick={remove}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <h2>{goal.title}</h2>
      {goal.target && <p>{goal.target}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(progress);
        }}
      >
        <label className="field">
          تقدّمي كما أراه{" "}
          <span className="space-goal-percent">
            {progress.toLocaleString("ar")}٪
          </span>
          <input
            type="range"
            aria-label={`تقدم هدف ${goal.title}`}
            min="0"
            max="100"
            step="5"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
          />
        </label>
        <button
          className="space-text-button"
          disabled={busy || progress === goal.progress}
        >
          <Check size={16} />
          احفظ التقدّم
        </button>
      </form>
    </article>
  );
}

function CalmTimer({
  sessions,
  busy,
  run,
  create,
  update,
}: {
  sessions: StudySession[];
  busy: boolean;
  run: (work: () => Promise<unknown>, success?: string) => Promise<boolean>;
  create: (values: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, values: Record<string, unknown>) => Promise<unknown>;
}) {
  const session = sessions.find(
    (s) => s.subject === "مساحة هادئة" && s.status !== "completed",
  );
  const [minutes, setMinutes] = useState(5);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = session
    ? session.elapsedSeconds +
      (session.status === "running"
        ? Math.max(
            0,
            Math.floor(
              (now -
                new Date(session.resumedAt || session.startedAt).getTime()) /
                1000,
            ),
          )
        : 0)
    : 0;
  const remaining = Math.max(0, (session?.minutes || minutes) * 60 - elapsed);
  const face = `${Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(remaining % 60)
    .toString()
    .padStart(2, "0")}`;
  async function start() {
    const stamp = new Date().toISOString();
    await run(() =>
      create({
        subject: "مساحة هادئة",
        minutes,
        status: "running",
        startedAt: stamp,
        resumedAt: stamp,
        elapsedSeconds: 0,
      }),
    );
    setNow(Date.now());
  }
  return (
    <section className="space-calm">
      <div className="space-calm-orbit" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="space-calm-content">
        <span className="space-calm-label">
          <Coffee size={18} />
          وقتك، بلا استعجال
        </span>
        <div
          className="space-timer-face"
          dir="ltr"
          aria-live="off"
          aria-label={`${Math.floor(remaining / 60)} دقيقة و${remaining % 60} ثانية متبقية`}
        >
          {face}
        </div>
        <p>
          {!session
            ? "اختر بضع دقائق لتبتعد عن ضجيج اليوم."
            : remaining === 0
              ? "انتهى الوقت المحدّد. أنهِ الجلسة عندما يناسبك."
              : session.status === "paused"
                ? "المؤقت متوقف. يمكنك العودة متى أردت."
                : "مساحة صغيرة، بإيقاعك أنت."}
        </p>
        {!session ? (
          <>
            <div className="space-minute-choices">
              {[5, 10, 15, 25].map((value) => (
                <button
                  key={value}
                  aria-pressed={minutes === value}
                  className={minutes === value ? "selected" : ""}
                  onClick={() => setMinutes(value)}
                >
                  {value.toLocaleString("ar")} د
                </button>
              ))}
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={start}>
              <Play size={17} />
              ابدأ وقتًا هادئًا
            </button>
          </>
        ) : (
          <div className="space-timer-actions">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                run(() =>
                  update(
                    session.id,
                    session.status === "running"
                      ? { status: "paused", elapsedSeconds: elapsed }
                      : {
                          status: "running",
                          resumedAt: new Date().toISOString(),
                        },
                  ),
                )
              }
            >
              {session.status === "running" ? (
                <Pause size={18} />
              ) : (
                <Play size={18} />
              )}{" "}
              {session.status === "running" ? "توقّف قليلًا" : "تابع"}
            </button>
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    update(session.id, {
                      status: "completed",
                      elapsedSeconds: elapsed,
                    }),
                  "حُفظت جلستك كما كانت، دون تقييم.",
                )
              }
            >
              <Square size={16} />
              أنه الجلسة
            </button>
          </div>
        )}
        <p className="space-privacy-footnote">
          يبقى الوقت محسوبًا عند إغلاق الشاشة؛ الإيقاف المؤقت يوقف الحساب.
        </p>
      </div>
    </section>
  );
}

function VoiceRecorder({
  assets,
  refresh,
  notify,
}: {
  assets: VoiceAsset[];
  refresh: () => Promise<unknown>;
  notify: (message: string, error?: boolean) => void;
}) {
  const mounted = useRef(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const begun = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const urls = useRef<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [playback, setPlayback] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (timer.current) clearInterval(timer.current);
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  function clearDraft() {
    if (preview) URL.revokeObjectURL(preview);
    setBlob(null);
    setPreview("");
    setSeconds(0);
    setTitle("");
  }
  async function start() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      notify(
        "التسجيل غير مدعوم هنا أو يحتاج اتصالًا آمنًا. يمكنك كتابة الفكرة بدلًا منه.",
        true,
      );
      return;
    }
    setRequesting(true);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current) {
        stream.current.getTracks().forEach((track) => track.stop());
        return;
      }
      chunks.current = [];
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      recorder.current = new MediaRecorder(
        stream.current,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      recorder.current.onstop = () => {
        if (!mounted.current) {
          stream.current?.getTracks().forEach((track) => track.stop());
          return;
        }
        const recorded = new Blob(chunks.current, {
          type: recorder.current?.mimeType || "audio/webm",
        });
        stream.current?.getTracks().forEach((track) => track.stop());
        if (timer.current) clearInterval(timer.current);
        setRecording(false);
        if (recorded.size) {
          const url = URL.createObjectURL(recorded);
          urls.current.push(url);
          setBlob(recorded);
          setPreview(url);
        } else notify("لم يُلتقط صوت. يمكنك المحاولة من جديد.", true);
      };
      recorder.current.onerror = () => {
        if (!mounted.current) return;
        notify("انقطع التسجيل. راجع المقطع المتاح قبل حفظه.", true);
        stream.current?.getTracks().forEach((track) => track.stop());
        setRecording(false);
        if (timer.current) clearInterval(timer.current);
      };
      recorder.current.start(1000);
      begun.current = Date.now();
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - begun.current) / 1000));
        if (
          Date.now() - begun.current >= 10 * 60 * 1000 &&
          recorder.current?.state === "recording"
        )
          recorder.current.stop();
      }, 500);
    } catch (error) {
      stream.current?.getTracks().forEach((track) => track.stop());
      notify(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "لم يُسمح بالميكروفون. يمكنك تفعيله من إعدادات المتصفح أو كتابة ملاحظة."
          : "تعذّر بدء التسجيل. تأكد من توفر الميكروفون وحاول مجددًا.",
        true,
      );
    } finally {
      setRequesting(false);
    }
  }
  async function save() {
    if (!blob) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append(
        "file",
        blob,
        blob.type.includes("mp4") ? "voice.m4a" : "voice.webm",
      );
      form.append("title", title.trim() || "فكرة صوتية");
      form.append("duration", String(seconds));
      const response = await fetch("/api/voice", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذّر حفظ التسجيل.");
      await refresh();
      clearDraft();
      notify("حُفظ التسجيل بشكل خاص. لم يُفرّغ أو يُرسل للتحليل.");
    } catch (e) {
      notify(
        e instanceof Error
          ? e.message
          : "تعذّر الحفظ؛ ما زال المقطع متاحًا للاستماع.",
        true,
      );
    } finally {
      setBusy(false);
    }
  }
  async function listen(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/voice/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("تعذّر تحميل التسجيل. حاول مرة أخرى.");
      const audio = await response.blob();
      if (!mounted.current) return;
      const url = URL.createObjectURL(audio);
      urls.current.push(url);
      setPlayback((previous) => ({ ...previous, [id]: url }));
    } catch (e) {
      notify(e instanceof Error ? e.message : "تعذّر تشغيل التسجيل.", true);
    } finally {
      setBusy(false);
    }
  }
  async function destroy(id: string) {
    setBusy(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/voice/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "تعذّر حذف التسجيل.");
      }
      if (playback[id]) URL.revokeObjectURL(playback[id]);
      setPlayback((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      await refresh();
      setDeleteId(null);
      notify("حُذف التسجيل.");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "تعذّر الحذف.");
      notify(e instanceof Error ? e.message : "تعذّر الحذف.", true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-voice">
      <div className="space-section-title">
        <div>
          <p className="eyebrow">حين تكون الفكرة أسرع من الكتابة</p>
          <h2>
            <Mic size={23} strokeWidth={1.3} />
            احفظها بصوتك.
          </h2>
        </div>
        {!blob && !recording && (
          <button
            className="btn btn-secondary"
            disabled={requesting || busy}
            onClick={start}
          >
            {requesting ? (
              <LoaderCircle className="space-spin" size={17} />
            ) : (
              <Mic size={17} />
            )}{" "}
            {requesting ? "بانتظار الإذن…" : "تسجيل صوتي"}
          </button>
        )}
      </div>
      <p className="space-privacy-footnote">
        تسجيل خاص، دون تفريغ نصي أو AI. يُرفع إلى التخزين الخاص عند اختيارك
        «احفظ» فقط.
      </p>
      {recording && (
        <div className="space-recording" role="status">
          <span className="space-recording-dot" />
          <strong>التسجيل جارٍ</strong>
          <span dir="ltr">
            {Math.floor(seconds / 60)
              .toString()
              .padStart(2, "0")}
            :{(seconds % 60).toString().padStart(2, "0")}
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => recorder.current?.stop()}
          >
            <Square size={16} />
            إيقاف ومراجعة
          </button>
        </div>
      )}
      {blob && (
        <div className="space-audio-draft">
          <label className="field">
            عنوان التسجيل
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="فكرة صوتية"
            />
          </label>
          <audio
            controls
            src={preview}
            aria-label="استمع إلى التسجيل قبل حفظه"
          />
          <div className="space-dialog-actions">
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              <Save size={16} />
              {busy ? "جارٍ الحفظ…" : "احفظ التسجيل"}
            </button>
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={clearDraft}
            >
              <Trash2 size={16} />
              احذف المسودة
            </button>
          </div>
        </div>
      )}
      {assets.length > 0 && (
        <div className="space-voice-list">
          {assets.map((asset) => (
            <div key={asset.id} className="space-voice-item">
              <span className="space-voice-icon">
                <Headphones size={19} />
              </span>
              <div>
                <strong>{asset.title}</strong>
                <span className="muted">
                  {asset.duration
                    ? `${Math.floor(asset.duration / 60).toLocaleString("ar")}:${Math.floor(
                        asset.duration % 60,
                      )
                        .toString()
                        .padStart(2, "0")}`
                    : ""}{" "}
                  · {(asset.size / 1024).toFixed(0)} KB
                </span>
                {playback[asset.id] && (
                  <audio
                    controls
                    src={playback[asset.id]}
                    aria-label={`تسجيل ${asset.title}`}
                  />
                )}
              </div>
              {!playback[asset.id] && (
                <button
                  className="space-icon-button"
                  disabled={busy}
                  aria-label={`استماع إلى ${asset.title}`}
                  onClick={() => listen(asset.id)}
                >
                  <Play size={18} />
                </button>
              )}
              <button
                className="space-icon-button danger"
                disabled={busy}
                aria-label={`حذف تسجيل ${asset.title}`}
                onClick={() => {
                  setDeleteError("");
                  setDeleteId(asset.id);
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {deleteId && (
        <Dialog
          title="حذف التسجيل نهائيًا؟"
          close={() => setDeleteId(null)}
          notice={deleteError ? { message: deleteError, error: true } : null}
        >
          <p>سيُحذف ملف الصوت من تخزينك الخاص.</p>
          <div className="space-dialog-actions">
            <button
              className="btn space-danger-button"
              disabled={busy}
              onClick={() => destroy(deleteId)}
            >
              احذف التسجيل
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setDeleteId(null)}
            >
              إلغاء
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
