"use client";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useApp } from "../app-provider";
import { openCycle, dayLabel } from "./shared";
import { cycleDay, localDate, phaseFor } from "@/lib/evolution";
import { number } from "@/lib/format";

/** Prominent MQW 90 entry for Today and My Space — facts only, no fake percentages. */
export function EvolutionEntry({
  variant = "today",
}: {
  variant?: "today" | "space";
}) {
  const { state } = useApp();
  if (!state) return null;
  const cycle = openCycle(state);
  const tz = cycle?.timezone || state.preferences.timezone;
  const today = localDate(tz);
  const day = cycle ? cycleDay(cycle.startDate, today) : 0;
  const daily =
    cycle &&
    state.evoDaily.find((d) => d.cycleId === cycle.id && d.date === today);
  const phase = phaseFor(day);
  return (
    <section
      className={`evo-entry evo-entry-${variant}`}
      aria-labelledby={`evo-entry-${variant}`}
    >
      <div className="evo-entry-mark" aria-hidden="true">
        <span dir="ltr">90</span>
      </div>
      <div className="evo-entry-copy">
        <span className="evo-kicker">
          <Sparkles size={13} aria-hidden="true" /> MQW 90 — My Evolution
        </span>
        <h2 id={`evo-entry-${variant}`}>رحلتي في ٩٠ يومًا</h2>
        {cycle ? (
          <p>
            <strong>{dayLabel(day)}</strong>
            {phase && ` · مرحلة ${phase.label}`}
            {cycle.state === "paused" && " · متوقفة مؤقتًا"}
            {daily?.focus ? ` · خطوتك: ${daily.focus}` : ""}
            {cycle.goals.length > 0 &&
              !daily?.focus &&
              ` · ${number(cycle.goals.length)} أهداف اخترتها`}
          </p>
        ) : (
          <p>
            البشرة، الشعر واللحية، المكمّلات، تمرين PPL، الرفاه، والاتزان — في
            مساحة خاصة تتحكم بها.
          </p>
        )}
      </div>
      <Link
        href={cycle ? "/evolution" : "/evolution/onboarding"}
        className={`btn ${variant === "space" ? "btn-primary" : "btn-secondary"} evo-entry-cta`}
      >
        {cycle ? (daily?.focus ? "افتح رحلتي" : "خطوتي اليوم") : "ابدأ رحلتك"}{" "}
        <ArrowLeft size={17} />
      </Link>
    </section>
  );
}
