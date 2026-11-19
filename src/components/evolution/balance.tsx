"use client";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import {
  useEvolution,
  useSaver,
  SectionTitle,
  Boundary,
  FormError,
  ConfirmDelete,
  Empty,
  Scale,
  PillarOff,
} from "./shared";
import { thisWeek } from "./derive";
import { BALANCE_DOMAINS } from "@/lib/evolution";
import { dateLabel, number } from "@/lib/format";
import { Button } from "../ui";

function WeeklyReview() {
  const { state, cycle, today } = useEvolution();
  const saver = useSaver();
  const week = thisWeek(today);
  const existing = state.evoWeekly.find(
    (w) => w.cycleId === cycle!.id && w.weekStart === week,
  );
  const domains = cycle!.balanceDomains.length
    ? cycle!.balanceDomains
    : BALANCE_DOMAINS;
  const [v, setV] = useState({
    domains: existing?.domains || [],
    win: existing?.win || "",
    constraint: existing?.constraint || "",
    nextAction: existing?.nextAction || "",
    balanceRating: existing?.balanceRating ?? null,
    useRating: existing?.balanceRating != null,
  });
  const toggle = (d: string) =>
    setV({
      ...v,
      domains: v.domains.includes(d)
        ? v.domains.filter((x) => x !== d)
        : v.domains.length >= 3
          ? v.domains
          : [...v.domains, d],
    });
  const history = state.evoWeekly
    .filter((w) => w.cycleId === cycle!.id)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  return (
    <section className="evo-panel" id="weekly" aria-labelledby="weekly-title">
      <SectionTitle
        title="مراجعة الأسبوع"
        kicker={`أسبوع ${dateLabel(week, undefined, { day: "numeric", month: "long" })} · خمس دقائق`}
      />
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          await saver.create(
            "evoWeekly",
            {
              cycleId: cycle!.id,
              weekStart: week,
              domains: v.domains,
              win: v.win,
              constraint: v.constraint,
              nextAction: v.nextAction,
              balanceRating: v.useRating ? v.balanceRating : null,
            },
            existing ? "حُدّثت مراجعة الأسبوع." : "حُفظت مراجعة الأسبوع.",
          );
        }}
      >
        <fieldset className="evo-fieldset">
          <legend>١. أي مجالات تستحق انتباهًا صغيرًا؟ (حتى ٣)</legend>
          <div className="evo-chips">
            {domains.map((d) => (
              <button
                key={d}
                type="button"
                className={`evo-chip ${v.domains.includes(d) ? "on" : ""}`}
                aria-pressed={v.domains.includes(d)}
                onClick={() => toggle(d)}
                disabled={!v.domains.includes(d) && v.domains.length >= 3}
              >
                {v.domains.includes(d) && <Check size={13} />} {d}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span>٢. شيء نجح هذا الأسبوع (اختياري)</span>
          <input
            value={v.win}
            maxLength={2000}
            onChange={(e) => setV({ ...v, win: e.target.value })}
          />
        </label>
        <label className="field">
          <span>عائق واجهته (اختياري)</span>
          <input
            value={v.constraint}
            maxLength={2000}
            onChange={(e) => setV({ ...v, constraint: e.target.value })}
          />
        </label>
        <label className="field">
          <span>٣. تعديل واحد صغير للأسبوع القادم</span>
          <input
            value={v.nextAction}
            maxLength={500}
            onChange={(e) => setV({ ...v, nextAction: e.target.value })}
            placeholder="مثلًا: نقل جلسة Legs إلى الأحد بسبب المحاضرات"
          />
        </label>
        <label className="evo-check">
          <input
            type="checkbox"
            checked={v.useRating}
            onChange={(e) => setV({ ...v, useRating: e.target.checked })}
          />{" "}
          أريد تقديرًا شخصيًا للاتزان (ليس اختبارًا نفسيًا)
        </label>
        {v.useRating && (
          <Scale
            label="كيف تشعر باتزان أسبوعك؟"
            value={v.balanceRating}
            onChange={(r) => setV({ ...v, balanceRating: r })}
            low="مختل"
            high="متزن"
          />
        )}
        <FormError error={saver.error} />
        <Button type="submit" loading={saver.busy}>
          {existing ? "حدّث المراجعة" : "احفظ المراجعة"}
        </Button>
        <p className="muted small">
          إن فاتتك مراجعة، لا بأس؛ الأسبوع القادم فرصة جديدة.
        </p>
      </form>
      {history.length > 0 && (
        <ul className="evo-timeline">
          {history.map((w) => (
            <li key={w.id}>
              <time>
                {dateLabel(w.weekStart, undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </time>
              <span>
                {w.nextAction ? `التعديل: ${w.nextAction}` : "مراجعة محفوظة"}
                {w.domains.length > 0 && (
                  <small> · {w.domains.join("، ")}</small>
                )}
              </span>
              <ConfirmDelete
                compact
                label="المراجعة"
                onConfirm={() => saver.remove("evoWeekly", w.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function BalancePage({
  focus,
}: {
  focus: "balance" | "weekly";
}) {
  const { state, cycle, enabled } = useEvolution();
  const saver = useSaver();
  const [custom, setCustom] = useState("");
  if (focus === "balance" && !enabled("balance"))
    return <PillarOff label="الاتزان الحياتي" />;
  const domains = cycle!.balanceDomains;
  const setDomains = (list: string[]) =>
    saver.update(
      "evoCycles",
      cycle!.id,
      { balanceDomains: list },
      "حُفظت مجالاتك.",
    );
  const counts = new Map<string, number>();
  for (const w of state.evoWeekly.filter((x) => x.cycleId === cycle!.id))
    for (const d of w.domains) counts.set(d, (counts.get(d) || 0) + 1);
  return (
    <div className="evo-pillar-page">
      <div className="evo-pillar-intro">
        <div>
          <h2>{focus === "weekly" ? "مراجعة الأسبوع" : "الاتزان الحياتي"}</h2>
          <p className="muted">
            مجالات تختارها أنت، ومراجعة قصيرة، وتعديل واحد للأسبوع القادم. لا
            يلزم توزيع الوقت بالتساوي.
          </p>
        </div>
      </div>
      {focus === "weekly" && <WeeklyReview />}
      <section className="evo-panel" aria-labelledby="domains-title">
        <SectionTitle title="مجالاتك" kicker="قابلة للتعديل" />
        <div className="evo-chips">
          {Array.from(new Set([...BALANCE_DOMAINS, ...domains])).map((d) => (
            <button
              key={d}
              type="button"
              className={`evo-chip ${domains.includes(d) ? "on" : ""}`}
              aria-pressed={domains.includes(d)}
              onClick={() =>
                setDomains(
                  domains.includes(d)
                    ? domains.filter((x) => x !== d)
                    : [...domains, d],
                )
              }
            >
              {domains.includes(d) && <Check size={13} />} {d}
            </button>
          ))}
        </div>
        <form
          className="evo-inline-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim())
              setDomains([...domains, custom.trim()]).then(() => setCustom(""));
          }}
        >
          <label className="field">
            <span>مجال جديد</span>
            <input
              value={custom}
              maxLength={80}
              onChange={(e) => setCustom(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-secondary">
            <Plus size={15} /> أضف
          </button>
        </form>
        <FormError error={saver.error} />
      </section>
      <section className="evo-panel" aria-labelledby="attention-title">
        <SectionTitle
          title="ما اخترته للانتباه"
          kicker="عدد المرات في مراجعاتك الأسبوعية"
        />
        {counts.size === 0 ? (
          <Empty title="لا مراجعات بعد">
            التأمل النوعي هو الأساس؛ لا عجلة توازن قبل وجود بيانات.
          </Empty>
        ) : (
          <ul className="evo-facts-list">
            {[...counts]
              .sort((a, b) => b[1] - a[1])
              .map(([d, n]) => (
                <li key={d}>
                  <span>{d}</span>
                  <strong>{number(n)}</strong>
                </li>
              ))}
          </ul>
        )}
      </section>
      {focus === "balance" && <WeeklyReview />}
      <Boundary>
        هذه مساحة تأمل شخصية، وليست تقييمًا نفسيًا. الساعات غير المسجّلة ليست وقتًا
        ضائعًا.
      </Boundary>
    </div>
  );
}
