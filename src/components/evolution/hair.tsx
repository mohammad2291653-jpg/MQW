"use client";
import { useState } from "react";
import { useEvolution, PillarOff, Boundary, Segmented } from "./shared";
import { CareJournal } from "./care";

export default function HairPage() {
  const { enabled } = useEvolution();
  const [area, setArea] = useState<"scalp" | "beard">("scalp");
  if (!enabled("hair")) return <PillarOff label="الشعر واللحية" />;
  return (
    <div className="evo-pillar-page">
      <div className="evo-pillar-intro">
        <div>
          <h2>الشعر واللحية</h2>
          <p className="muted">
            سجلّان منفصلان تمامًا لفروة الرأس واللحية: منتجات، استخدام فعلي،
            ملاحظات وصور خاصة.
          </p>
        </div>
        <Segmented
          label="المنطقة"
          value={area}
          onChange={setArea}
          options={[
            { value: "scalp", label: "فروة الرأس" },
            { value: "beard", label: "اللحية" },
          ]}
        />
      </div>
      <Boundary title="للتتبع، لا للوصف">
        لا يقترح التطبيق تركيز المينوكسيديل أو جرعته أو تكراره؛ سجّل ما هو مكتوب
        على منتجك أو ما حدده مختصك. تعليمات منتجات فروة الرأس قد لا تشمل اللحية،
        واستخدامها للّحية قد يكون خارج الاستخدام المعتمد. لا توقعات لنمو الشعر.
      </Boundary>
      <CareJournal key={area} pillar="hair" area={area} />
    </div>
  );
}
