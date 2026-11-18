import type { AppState } from "./types";
export type Insight = {
  id: string;
  kind: "observed" | "preference" | "hypothesis";
  title: string;
  observation: string;
  caveat: string;
  action: string;
  sources: string[];
  numerator: number;
  denominator: number;
  from: string;
  to: string;
};
export function deriveInsights(state: AppState, now = new Date()): Insight[] {
  const from = new Date(now.getTime() - 30 * 86400000).toISOString(),
    to = now.toISOString();
  const answers = state.answers.filter(
    (a) =>
      a.createdAt >= from &&
      a.createdAt <= to &&
      a.gradingSource === "deterministic" &&
      typeof a.correct === "boolean",
  );
  const hidden = new Set(state.insightFeedback.map((f) => f.ruleId));
  const results: Insight[] = [];
  if (answers.length && !hidden.has("quiz-facts-v1"))
    results.push({
      id: "quiz-facts-v1",
      kind: "observed",
      title: "ما تقوله اختباراتك",
      observation: `أجبت إجابة صحيحة عن ${answers.filter((a) => a.correct).length} من ${answers.length} أسئلة مصحّحة بالقواعد خلال آخر 30 يومًا.`,
      caveat:
        "هذه نتائج أسئلة الاختيار والترتيب، وتشمل المحاولات المسجلة. لا تقيس وحدها الفهم الكامل أو الاستدعاء الحر.",
      action: "جرّب كتابة الإجابة من الذاكرة قبل النظر إلى البدائل.",
      sources: answers.map((a) => a.id),
      numerator: answers.filter((a) => a.correct).length,
      denominator: answers.length,
      from,
      to,
    });
  const reviewed = state.reviewEvents.filter(
    (e) =>
      e.kind === "attempt" &&
      !!e.rating &&
      e.createdAt >= from &&
      e.createdAt <= to,
  );
  if (reviewed.length && !hidden.has("review-facts-v1"))
    results.push({
      id: "review-facts-v1",
      kind: "observed",
      title: "عودتك إلى المعرفة",
      observation: `سجّلت ${reviewed.length} مراجعات لاحقة؛ قيّمت ${reviewed.filter((e) => e.rating === "good").length} منها بـ«تذكرت».`,
      caveat:
        "هذا تقييمك الذاتي للمراجعات، ويُعرض منفصلًا عن التصحيح الآلي. لا نعتبر الموعد المجدول محاولة استدعاء.",
      action: "في المراجعة المقبلة، حاول الاستدعاء قبل كشف الإجابة.",
      sources: reviewed.map((e) => e.id),
      numerator: reviewed.filter((e) => e.rating === "good").length,
      denominator: reviewed.length,
      from,
      to,
    });
  return results;
}
