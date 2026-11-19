"use client";
import Link from "next/link";
import { useState } from "react";
import { ShieldAlert, Info, Trash2, LoaderCircle } from "lucide-react";
import { useApp } from "../app-provider";
import { useToast } from "../ui";
import {
  cycleDay,
  cycleEnd,
  localDate,
  phaseFor,
  type PillarKey,
} from "@/lib/evolution";
import type { AppState, Collection, EvoCycle } from "@/lib/types";
import { number } from "@/lib/format";

/** The cycle that is currently open (draft/active/paused), if any. */
export function openCycle(state: AppState): EvoCycle | undefined {
  return state.evoCycles.find((c) =>
    ["active", "paused", "draft"].includes(c.state),
  );
}
export function useEvolution() {
  const app = useApp();
  const state = app.state!;
  const cycle = openCycle(state);
  const timezone = cycle?.timezone || state.preferences.timezone;
  const today = localDate(timezone);
  const day = cycle ? cycleDay(cycle.startDate, today) : 0;
  return {
    ...app,
    state,
    cycle,
    timezone,
    today,
    day,
    phase: phaseFor(day),
    end: cycle ? cycleEnd(cycle.startDate) : undefined,
    enabled: (p: PillarKey) => !!cycle?.pillars[p],
  };
}
export function dayLabel(day: number) {
  if (day < 1)
    return `تبدأ بعد ${number(1 - day)} ${1 - day === 1 ? "يوم" : "أيام"}`;
  if (day > 90) return "اكتملت الأيام التسعون";
  return `اليوم ${number(day)} من ٩٠`;
}

/** Wraps create/update/remove with honest saved/failed feedback. */
export function useSaver() {
  const { create, update, remove } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run<T>(fn: () => Promise<T>, saved = "حُفظ وتأكّد التخزين.") {
    setBusy(true);
    setError("");
    try {
      const value = await fn();
      if (saved) toast(saved);
      return value;
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ. حاول مجددًا.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    setError,
    run,
    create: (c: Collection, v: Record<string, unknown>, msg?: string) =>
      run(() => create(c, v), msg),
    update: (
      c: Collection,
      id: string,
      v: Record<string, unknown>,
      msg?: string,
    ) => run(() => update(c, id, v), msg),
    remove: (c: Collection, id: string, msg = "حُذف السجل.") =>
      run(() => remove(c, id), msg),
  };
}

export function FormError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="error-message evo-error">
      {error}
    </p>
  );
}

/** Calm, non-alarmist boundary note. */
export function Boundary({
  children,
  tone = "info",
  title,
}: {
  children: React.ReactNode;
  tone?: "info" | "care";
  title?: string;
}) {
  return (
    <aside className={`evo-boundary ${tone}`}>
      {tone === "care" ? (
        <ShieldAlert size={18} aria-hidden="true" />
      ) : (
        <Info size={18} aria-hidden="true" />
      )}
      <div>
        {title && <strong>{title}</strong>}
        <p>{children}</p>
      </div>
    </aside>
  );
}

export function SectionTitle({
  title,
  kicker,
  action,
}: {
  title: string;
  kicker?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="evo-section-title">
      <div>
        {kicker && <span className="evo-kicker">{kicker}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function NoCycle() {
  return (
    <div className="evo-empty">
      <h2>لم تبدأ دورة بعد</h2>
      <p>اختر تاريخ البداية وأهدافك وأقسامك أولًا. لا شيء يُسجَّل نيابة عنك.</p>
      <Link className="btn btn-primary" href="/evolution/onboarding">
        ابدأ إعداد رحلتك
      </Link>
    </div>
  );
}
export function PillarOff({ label }: { label: string }) {
  return (
    <div className="evo-empty">
      <h2>قسم {label} مخفي</h2>
      <p>
        أخفيت هذا القسم من رحلتك. سجلاتك السابقة محفوظة، ويمكنك إظهاره متى شئت.
      </p>
      <Link className="btn btn-secondary" href="/evolution/settings">
        إعدادات الأقسام
      </Link>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="evo-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === o.value}
          key={o.value}
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 1–5 scale with descriptive anchors; always optional. */
export function Scale({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  low: string;
  high: string;
}) {
  return (
    <fieldset className="evo-scale">
      <legend>{label}</legend>
      <div className="evo-scale-row">
        <small>{low}</small>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            aria-pressed={value === n}
            aria-label={`${label}: ${n} من ٥`}
            className={value === n ? "on" : ""}
            onClick={() => onChange(value === n ? null : n)}
          >
            {number(n)}
          </button>
        ))}
        <small>{high}</small>
      </div>
    </fieldset>
  );
}

export function ConfirmDelete({
  label,
  onConfirm,
  compact,
}: {
  label: string;
  onConfirm: () => Promise<unknown>;
  compact?: boolean;
}) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!ask)
    return (
      <button
        type="button"
        className={compact ? "evo-icon-btn" : "btn btn-ghost"}
        aria-label={`حذف ${label}`}
        onClick={() => setAsk(true)}
      >
        <Trash2 size={16} /> {!compact && "حذف"}
      </button>
    );
  return (
    <span
      className="evo-confirm"
      role="group"
      aria-label={`تأكيد حذف ${label}`}
    >
      <span>حذف نهائي؟</span>
      <button
        type="button"
        className="btn btn-danger"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onConfirm();
          setBusy(false);
          setAsk(false);
        }}
      >
        {busy && <LoaderCircle className="spin" size={14} />} نعم، احذف
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setAsk(false)}
      >
        تراجع
      </button>
    </span>
  );
}

export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="evo-empty small">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
