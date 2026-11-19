"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Plus, X, Lock } from "lucide-react";
import { useEvolution, useSaver, FormError, Boundary } from "./shared";
import {
  PILLARS,
  PILLAR_LABELS,
  cycleEnd,
  isDay,
  type PillarKey,
} from "@/lib/evolution";
import { dateLabel } from "@/lib/format";
import { Button } from "../ui";

const SUGGESTIONS = [
  "ثلاث جلسات تمرين أسبوعيًا",
  "توثيق تجربة منتج البشرة بانتظام",
  "تسجيل المكمّلات كما خططت لها",
  "مراجعة أسبوعية من خمس دقائق",
  "نوم وراحة كافيان",
];
const PILLAR_HINTS: Record<PillarKey, string> = {
  skin: "تجربة منتج شخصية، ملاحظات وصور خاصة",
  hair: "فروة الرأس واللحية منفصلتان؛ سجل فقط",
  supplements: "جدول تكتبه أنت، وسجل أخذ/تخطٍّ فعلي",
  fitness: "قوالب Push / Pull / Legs وسجل المجموعات",
  wellbeing: "اختياري تمامًا؛ مغلق افتراضيًا",
  balance: "مجالات تختارها ومراجعة أسبوعية قصيرة",
};

export default function Onboarding() {
  const { state, cycle, today } = useEvolution();
  const router = useRouter();
  const saver = useSaver();
  const draft = cycle?.state === "draft" ? cycle : undefined;
  const [startDate, setStartDate] = useState(draft?.startDate || today);
  const [timezone, setTimezone] = useState(
    draft?.timezone || state.preferences.timezone,
  );
  const [goals, setGoals] = useState<string[]>(
    draft?.goals.map((g) => g.title) || [],
  );
  const [custom, setCustom] = useState("");
  const [pillars, setPillars] = useState<Record<PillarKey, boolean>>(
    draft?.pillars || {
      skin: true,
      hair: true,
      supplements: true,
      fitness: true,
      wellbeing: false,
      balance: true,
    },
  );
  if (cycle && cycle.state !== "draft")
    return (
      <div className="evo-empty">
        <h2>لديك دورة مفتوحة</h2>
        <p>
          أكمل دورتك الحالية أو أرشفها من الإعدادات قبل بدء دورة جديدة. التاريخ
          السابق يبقى محفوظًا.
        </p>
        <Link href="/evolution" className="btn btn-primary">
          العودة إلى رحلتي
        </Link>
      </div>
    );
  const toggleGoal = (g: string) =>
    setGoals((list) =>
      list.includes(g)
        ? list.filter((x) => x !== g)
        : list.length >= 3
          ? list
          : [...list, g],
    );
  async function submit(asDraft: boolean) {
    if (!isDay(startDate)) return saver.setError("اختر تاريخ بداية صحيحًا.");
    if (!asDraft && goals.length < 1)
      return saver.setError("اختر هدفًا واحدًا على الأقل (حتى ثلاثة).");
    const values = {
      startDate,
      timezone,
      state: asDraft ? "draft" : "active",
      goals: goals.map((title) => ({ title })),
      pillars,
    };
    const ok = draft
      ? await saver.update(
          "evoCycles",
          draft.id,
          values,
          asDraft ? "حُفظت المسودة." : "بدأت رحلتك.",
        )
      : await saver.create(
          "evoCycles",
          values,
          asDraft ? "حُفظت المسودة." : "بدأت رحلتك.",
        );
    if (ok && !asDraft) router.push("/evolution");
  }
  const zones = Array.from(
    new Set([
      timezone,
      "Asia/Hebron",
      "Asia/Jerusalem",
      "Asia/Amman",
      "Asia/Riyadh",
      "Asia/Dubai",
      "Africa/Cairo",
      "Europe/Istanbul",
      "Europe/London",
      "UTC",
    ]),
  );
  return (
    <div className="evo-onboarding">
      <header className="evo-onboarding-head">
        <p className="eyebrow">MQW 90 — My Evolution</p>
        <h1>رحلة شخصية لتسعين يومًا</h1>
        <p className="page-description">
          مساحة خاصة لمتابعة ما تختاره أنت: البشرة، الشعر واللحية، المكمّلات،
          التمرين، الرفاه، والاتزان. لا نسب وهمية، ولا وعود بنتائج.
        </p>
      </header>
      <form
        className="evo-onboarding-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <section className="evo-step" aria-labelledby="step-date">
          <span className="evo-step-no" aria-hidden="true">
            ١
          </span>
          <div>
            <h2 id="step-date">متى تبدأ؟</h2>
            <div className="evo-grid-2">
              <label className="field">
                <span>تاريخ اليوم الأول</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>المنطقة الزمنية</span>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {isDay(startDate) && (
              <p className="muted">
                اليوم ١: {dateLabel(startDate)} · اليوم ٩٠:{" "}
                {dateLabel(cycleEnd(startDate))}
              </p>
            )}
          </div>
        </section>
        <section className="evo-step" aria-labelledby="step-goals">
          <span className="evo-step-no" aria-hidden="true">
            ٢
          </span>
          <div>
            <h2 id="step-goals">اختر هدفين أو ثلاثة فقط</h2>
            <p className="muted">
              أهداف قابلة للتعديل، تقيس ما تفعله أنت — لا وعودًا بنتائج صحية أو
              شكلية.
            </p>
            <div className="evo-chips" role="group" aria-label="أهداف مقترحة">
              {[...new Set([...SUGGESTIONS, ...goals])].map((g) => (
                <button
                  type="button"
                  key={g}
                  className={`evo-chip ${goals.includes(g) ? "on" : ""}`}
                  aria-pressed={goals.includes(g)}
                  onClick={() => toggleGoal(g)}
                  disabled={!goals.includes(g) && goals.length >= 3}
                >
                  {goals.includes(g) ? <Check size={14} /> : <Plus size={14} />}{" "}
                  {g}
                </button>
              ))}
            </div>
            <div className="evo-inline-add">
              <label className="field">
                <span>هدف بصياغتك</span>
                <input
                  value={custom}
                  maxLength={300}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="مثلًا: أربع مراجعات أسبوعية لقصر الذاكرة"
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!custom.trim() || goals.length >= 3}
                onClick={() => {
                  toggleGoal(custom.trim());
                  setCustom("");
                }}
              >
                أضف
              </button>
            </div>
            <p className="muted" aria-live="polite">
              اخترت {goals.length} من ٣.
            </p>
          </div>
        </section>
        <section className="evo-step" aria-labelledby="step-pillars">
          <span className="evo-step-no" aria-hidden="true">
            ٣
          </span>
          <div>
            <h2 id="step-pillars">الأقسام التي تريدها</h2>
            <p className="muted">يمكنك إخفاء أي قسم لاحقًا دون حذف سجلاته.</p>
            <div className="evo-pillar-toggles">
              {PILLARS.map((p) => (
                <label
                  key={p}
                  className={`evo-toggle ${pillars[p] ? "on" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={pillars[p]}
                    onChange={(e) =>
                      setPillars({ ...pillars, [p]: e.target.checked })
                    }
                  />
                  <span>
                    <strong>{PILLAR_LABELS[p]}</strong>
                    <small>{PILLAR_HINTS[p]}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>
        <section className="evo-step" aria-labelledby="step-privacy">
          <span className="evo-step-no" aria-hidden="true">
            <Lock size={15} />
          </span>
          <div>
            <h2 id="step-privacy">خصوصيتك</h2>
            <ul className="evo-privacy-list">
              <li>
                كل السجلات خاصة بحسابك ومحمية بالتحقق من المالك في كل طلب.
              </li>
              <li>
                الصور تُحفظ بشكل خاص بعد إزالة بيانات الموقع (EXIF)، ولا تملك
                رابطًا عامًا.
              </li>
              <li>
                لا يُرسل أي شيء إلى AI. لا تحليل تلقائي للبشرة أو الشعر أو
                المزاج.
              </li>
              <li>
                التطبيق لا يصف جرعات أو بروتوكولات علاجية؛ يسجّل ما تكتبه أنت أو
                مختصك.
              </li>
              <li>يمكنك تصدير بياناتك أو حذف أي قسم بالكامل من الإعدادات.</li>
            </ul>
          </div>
        </section>
        <Boundary>
          المحطات في الأيام ١ و٣٠ و٦٠ و٩٠ مراجعات اختيارية، وليست وعودًا بنتائج
          طبية أو شكلية.
        </Boundary>
        <FormError error={saver.error} />
        <div className="evo-actions">
          <Button type="submit" loading={saver.busy}>
            ابدأ الرحلة <Check size={17} />
          </Button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saver.busy}
            onClick={() => submit(true)}
          >
            احفظ كمسودة
          </button>
          <Link href="/space" className="btn btn-ghost">
            <X size={16} /> ليس الآن
          </Link>
        </div>
      </form>
    </div>
  );
}
