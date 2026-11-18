"use client";
import Link from "next/link";
import {
  ArrowUpLeft,
  BookOpen,
  Check,
  Clock3,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { LESSONS } from "@/lib/lessons";
import { useApp } from "@/components/app-provider";

export default function LearnPage() {
  const { state } = useApp();
  const completed = new Set(
    state?.lessonAttempts
      .filter((a) => a.status === "completed")
      .map((a) => a.lessonSlug),
  );
  const due =
    state?.reviews.filter(
      (card) =>
        card.target === "question" &&
        new Date(card.dueAt).getTime() <= Date.now(),
    ).length ?? 0;
  return (
    <div className="page learn-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">مساحة للفهم والتجربة</p>
          <h1 className="page-title">
            تعلّم كيف تتعلّم<span className="accent-dot">.</span>
          </h1>
          <p className="page-description">
            فكرة صغيرة. محاولة حقيقية. معرفة تبقى معك.
          </p>
        </div>
        <span className="pill">
          <BookOpen size={16} /> أربعة دروس، بداية من الصفر
        </span>
      </header>
      <section className="learning-intro panel">
        <div>
          <span className="eyebrow">رحلتك الأولى</span>
          <h2>لا تكتفِ بأن تبدو المعلومة مألوفة.</h2>
          <p>
            اختبر ما تتذكره، افهم سبب الخطأ، وعد إليه في موعد آخر. لا تحتاج أي
            أداة AI لتبدأ.
          </p>
        </div>
        <div className="learning-orbit" aria-hidden="true">
          <span>اقرأ</span>
          <span>استدعِ</span>
          <span>تحقّق</span>
          <span>عُد لاحقًا</span>
          <Sparkles size={28} />
        </div>
      </section>
      <div className="section-heading">
        <h2>مسار التعلّم</h2>
        <span className="muted">
          {completed.size.toLocaleString("ar-PS")} من ٤ دروس مكتملة
        </span>
      </div>
      <ol className="lesson-path">
        {LESSONS.map((lesson) => {
          const done = completed.has(lesson.slug);
          const active = state?.lessonAttempts.some(
            (a) => a.lessonSlug === lesson.slug && a.status === "in_progress",
          );
          return (
            <li
              className={`lesson-item lesson-${lesson.color}`}
              key={lesson.slug}
            >
              <div className={`lesson-number ${done ? "is-complete" : ""}`}>
                {done ? (
                  <Check size={22} />
                ) : (
                  String(lesson.number).padStart(2, "0")
                )}
              </div>
              <div className="lesson-item-content">
                <p className="eyebrow" dir="ltr">
                  {lesson.english}
                </p>
                <h3>
                  <Link href={`/learn/${lesson.slug}`}>{lesson.title}</Link>
                </h3>
                <p>{lesson.description}</p>
                <span className="lesson-duration muted">
                  <Clock3 size={14} /> {lesson.duration} · تقدير مرن
                </span>
              </div>
              <Link className="button secondary" href={`/learn/${lesson.slug}`}>
                {active ? "تابع الدرس" : done ? "افتح الدرس" : "ابدأ الدرس"}
                <ArrowUpLeft size={17} />
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="learning-tools">
        <Link href="/reviews" className="panel learning-tool">
          <RotateCcw size={23} />
          <h3>المراجعات</h3>
          <p>
            {due
              ? `لديك ${due.toLocaleString("ar-PS")} مراجعات يحين وقتها الآن.`
              : "مواعيد واضحة، واستدعاء آخر دون ضغط."}
          </p>
          <span className="text-link">
            افتح المراجعات <ArrowUpLeft size={16} />
          </span>
        </Link>
        <Link href="/study" className="panel learning-tool">
          <Clock3 size={23} />
          <h3>جلسة لمادتك</h3>
          <p>نظّم موضوعاتك وابدأ جلسة بالوقت الذي يناسبك.</p>
          <span className="text-link">
            مساحة الدراسة <ArrowUpLeft size={16} />
          </span>
        </Link>
      </div>
      <p className="footnote">
        أمثلة الأحياء أصلية للتدريب على طريقة التعلّم، ولا تمثل منهجك الجامعي أو
        تغطية كاملة له.
      </p>
    </div>
  );
}
