"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Castle, Check, ShieldCheck } from "lucide-react";
import { useApp } from "./app-provider";
import { LearningArt } from "./art";
export default function Onboarding() {
  const { savePreferences } = useApp(),
    router = useRouter();
  const [step, setStep] = useState(0),
    [error, setError] = useState("");
  const panels = [
    {
      icon: BookOpen,
      title: "تعلّم كيف تتعلّم.",
      text: "شرح من الصفر، ثم محاولة حقيقية. ستفهم لماذا أخطأت، وتعود للمراجعة عندما تحتاجها.",
    },
    {
      icon: Castle,
      title: "أعطِ المعرفة مكانًا.",
      text: "قصر جاهز من خمس محطات. استكشف المسار، واربط به أفكارك، ثم جرّب استدعاءها.",
    },
    {
      icon: ShieldCheck,
      title: "كل شيء تحت سيطرتك.",
      text: "لا تحليل لملاحظاتك أو صوتك. AI الخارجي غير متصل، والتعلّم يعمل بالكامل دونه.",
    },
  ];
  const p = panels[step],
    Icon = p.icon;
  async function finish(startLesson = false) {
    try {
      await savePreferences({ onboardingDone: true });
      router.push(startLesson ? "/learn/familiarity-is-not-recall" : "/today");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="onboarding">
      <div className="onboarding-art">
        <LearningArt />
      </div>
      <span className="soft-icon">
        <Icon size={25} />
      </span>
      <h1>{p.title}</h1>
      <p>{p.text}</p>
      <div className="onboarding-dots">
        {panels.map((_, i) => (
          <span key={i} className={i === step ? "active" : ""} />
        ))}
      </div>
      {error && <p className="error-message">{error}</p>}
      <button
        className="btn btn-primary"
        onClick={() => (step < 2 ? setStep(step + 1) : finish(true))}
      >
        {step < 2 ? "التالي" : "ابدأ الدرس الأول"}
        <ArrowLeft size={18} />
      </button>
      <button className="btn btn-ghost" onClick={() => finish()}>
        تخطي المقدمة
      </button>
    </div>
  );
}
