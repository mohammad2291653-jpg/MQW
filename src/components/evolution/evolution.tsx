"use client";
import Link from "next/link";
import {
  Compass,
  Droplets,
  Scissors,
  Pill,
  Dumbbell,
  HeartHandshake,
  Scale as ScaleIcon,
  FileBarChart,
  SlidersHorizontal,
  NotebookPen,
} from "lucide-react";
import { useEvolution, dayLabel } from "./shared";
import Onboarding from "./onboarding";
import Overview from "./overview";
import SkinPage from "./skin";
import HairPage from "./hair";
import SupplementsPage from "./supplements";
import FitnessPage from "./fitness";
import WellbeingPage from "./wellbeing";
import BalancePage from "./balance";
import ReportPage from "./report";
import EvoSettings from "./settings";
import { PHASES } from "@/lib/evolution";
import "./evolution.css";

const SECTIONS = [
  { id: "", label: "نظرة عامة", icon: Compass },
  { id: "skin", label: "البشرة", icon: Droplets, pillar: "skin" },
  { id: "hair", label: "الشعر واللحية", icon: Scissors, pillar: "hair" },
  { id: "supplements", label: "المكمّلات", icon: Pill, pillar: "supplements" },
  { id: "fitness", label: "التمرين", icon: Dumbbell, pillar: "fitness" },
  {
    id: "wellbeing",
    label: "الرفاه",
    icon: HeartHandshake,
    pillar: "wellbeing",
  },
  { id: "balance", label: "الاتزان", icon: ScaleIcon, pillar: "balance" },
  { id: "weekly", label: "مراجعة الأسبوع", icon: NotebookPen },
  { id: "report", label: "التقرير", icon: FileBarChart },
  { id: "settings", label: "الإعدادات", icon: SlidersHorizontal },
] as const;

export default function EvolutionPage({ path }: { path: string[] }) {
  const evo = useEvolution();
  const [section, ...rest] = path;
  const { cycle, day } = evo;
  if (
    section === "onboarding" ||
    (!cycle && !["report", "settings"].includes(section || ""))
  )
    return (
      <div className="evo-page">
        <Onboarding />
      </div>
    );
  const visible = SECTIONS.filter(
    (s) => !("pillar" in s) || evo.enabled(s.pillar as never),
  );
  let body: React.ReactNode;
  switch (section || "") {
    case "":
      body = <Overview />;
      break;
    case "skin":
      body = <SkinPage view={rest[0]} />;
      break;
    case "hair":
      body = <HairPage />;
      break;
    case "supplements":
      body = <SupplementsPage />;
      break;
    case "fitness":
      body = (
        <FitnessPage sessionId={rest[0] === "session" ? rest[1] : undefined} />
      );
      break;
    case "wellbeing":
      body = <WellbeingPage />;
      break;
    case "balance":
    case "weekly":
      body = <BalancePage focus={section as "balance" | "weekly"} />;
      break;
    case "report":
      body = <ReportPage />;
      break;
    case "settings":
      body = <EvoSettings />;
      break;
    default:
      body = (
        <div className="evo-empty">
          <h2>هذا القسم غير موجود</h2>
          <Link href="/evolution" className="btn btn-secondary">
            العودة إلى رحلتي
          </Link>
        </div>
      );
  }
  const phaseIndex = PHASES.findIndex((p) => day >= p.from && day <= p.to);
  return (
    <div className="evo-page">
      <header className="evo-hero">
        <div className="evo-hero-copy">
          <p className="eyebrow">
            <Link href="/space">مساحتي</Link> <span aria-hidden="true">/</span>{" "}
            MQW 90 — My Evolution
          </p>
          <h1>رحلتي خلال ٩٠ يومًا</h1>
          {cycle ? (
            <p className="evo-hero-status">
              <strong>{dayLabel(day)}</strong>
              {cycle.state === "paused" && (
                <span className="evo-badge">متوقفة مؤقتًا</span>
              )}
              {cycle.state === "draft" && (
                <span className="evo-badge">مسودة</span>
              )}
            </p>
          ) : (
            <p className="evo-hero-status">لا توجد دورة مفتوحة.</p>
          )}
        </div>
        {cycle && (
          <ol className="evo-phases" aria-label="مراحل الدورة">
            {PHASES.map((p, i) => (
              <li
                key={p.key}
                className={
                  i === phaseIndex
                    ? "current"
                    : i < phaseIndex || day > 90
                      ? "past"
                      : ""
                }
                aria-current={i === phaseIndex ? "step" : undefined}
              >
                <span className="evo-phase-name">{p.label}</span>
                <span className="evo-phase-days" dir="ltr">
                  {p.from}–{p.to}
                </span>
              </li>
            ))}
          </ol>
        )}
      </header>
      <nav className="evo-nav" aria-label="أقسام رحلة ٩٠ يومًا">
        {visible.map((s) => {
          const href = s.id ? `/evolution/${s.id}` : "/evolution";
          const active = (section || "") === s.id;
          return (
            <Link
              key={s.id}
              href={href}
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
            >
              <s.icon size={17} aria-hidden="true" />
              <span>{s.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="evo-body">{body}</div>
    </div>
  );
}
