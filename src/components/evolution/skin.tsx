"use client";
import Link from "next/link";
import { useState } from "react";
import { Briefcase, ArrowLeft, ArrowRight } from "lucide-react";
import {
  useEvolution,
  useSaver,
  PillarOff,
  SectionTitle,
  Boundary,
  FormError,
  ConfirmDelete,
  Empty,
} from "./shared";
import { CareJournal } from "./care";
import type { EvoAgencyReview } from "@/lib/types";
import { Button } from "../ui";

const CHECKLIST = [
  ["documents", "طلبت شهادات التحليل ووثائق المصنّع"],
  ["ingredients", "تحققت من قائمة المكوّنات من مصدر مستقل"],
  ["registration", "راجعت متطلبات التسجيل في بلد التوزيع"],
  ["claims", "لا ادعاءات فعالية غير موثّقة في أي مادة تسويقية"],
  ["legal", "استشرت جهة قانونية بشأن الوكالة"],
] as const;
const DECISIONS: Record<EvoAgencyReview["decision"], string> = {
  exploring: "قيد الاستكشاف",
  on_hold: "معلّق",
  declined: "قررت عدم المتابعة",
  pursuing: "أتابع رسميًا",
};

function Agency() {
  const { state } = useEvolution();
  const saver = useSaver();
  const blank = {
    productName: "",
    supplier: "",
    manufacturer: "",
    territory: "",
    documentsRequested: "",
    claimsToVerify: "",
    priceNotes: "",
    notes: "",
    decision: "exploring",
    checklist: {} as Record<string, boolean>,
  };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const set =
    (k: keyof typeof blank) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setForm({ ...form, [k]: e.target.value });
  return (
    <div className="evo-agency">
      <Link href="/evolution/skin" className="text-link">
        <ArrowRight size={14} /> العودة إلى سجل البشرة الشخصي
      </Link>
      <SectionTitle title="تقييم تجاري منفصل" kicker="وكالة أو توزيع محتمل" />
      <Boundary title="منفصل تمامًا عن بياناتك الصحية">
        لا يرتبط هذا القسم بصورك أو ملاحظاتك الشخصية، ولا يوجد زر مشاركة
        تسويقية. التجربة الشخصية لا تثبت سلامة المنتج أو فعاليته أو موافقته
        التنظيمية.
      </Boundary>
      <form
        className="evo-panel stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = editing
            ? await saver.update("evoAgencyReviews", editing, form)
            : await saver.create(
                "evoAgencyReviews",
                form,
                "حُفظ التقييم التجاري.",
              );
          if (ok) {
            setForm(blank);
            setEditing(null);
          }
        }}
      >
        <div className="evo-grid-2">
          <label className="field">
            <span>اسم المنتج</span>
            <input
              value={form.productName}
              onChange={set("productName")}
              required
              maxLength={200}
            />
          </label>
          <label className="field">
            <span>المورّد</span>
            <input
              value={form.supplier}
              onChange={set("supplier")}
              maxLength={300}
            />
          </label>
          <label className="field">
            <span>المصنّع</span>
            <input
              value={form.manufacturer}
              onChange={set("manufacturer")}
              maxLength={300}
            />
          </label>
          <label className="field">
            <span>منطقة التوزيع المهتم بها</span>
            <input
              value={form.territory}
              onChange={set("territory")}
              maxLength={300}
            />
          </label>
        </div>
        <label className="field">
          <span>الوثائق المطلوبة</span>
          <textarea
            rows={2}
            value={form.documentsRequested}
            onChange={set("documentsRequested")}
            maxLength={3000}
          />
        </label>
        <label className="field">
          <span>ادعاءات يجب التحقق منها</span>
          <textarea
            rows={2}
            value={form.claimsToVerify}
            onChange={set("claimsToVerify")}
            maxLength={3000}
          />
        </label>
        <fieldset className="evo-checklist">
          <legend>قائمة تحقق قانونية وتنظيمية</legend>
          {CHECKLIST.map(([k, l]) => (
            <label key={k} className="evo-check">
              <input
                type="checkbox"
                checked={!!form.checklist[k]}
                onChange={(e) =>
                  setForm({
                    ...form,
                    checklist: { ...form.checklist, [k]: e.target.checked },
                  })
                }
              />{" "}
              {l}
            </label>
          ))}
        </fieldset>
        <div className="evo-grid-2">
          <label className="field">
            <span>السعر والتوفر</span>
            <input
              value={form.priceNotes}
              onChange={set("priceNotes")}
              maxLength={1000}
            />
          </label>
          <label className="field">
            <span>حالة القرار</span>
            <select value={form.decision} onChange={set("decision")}>
              {Object.entries(DECISIONS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>ملاحظات</span>
          <textarea
            rows={2}
            value={form.notes}
            onChange={set("notes")}
            maxLength={5000}
          />
        </label>
        <FormError error={saver.error} />
        <Button type="submit" loading={saver.busy}>
          {editing ? "احفظ التعديل" : "احفظ التقييم"}
        </Button>
      </form>
      {state.evoAgencyReviews.length === 0 ? (
        <Empty title="لا تقييمات تجارية بعد" />
      ) : (
        <ul className="evo-list">
          {state.evoAgencyReviews.map((r) => (
            <li key={r.id}>
              <Briefcase size={18} aria-hidden="true" />
              <div>
                <strong>{r.productName}</strong>
                <small>
                  {DECISIONS[r.decision]} ·{" "}
                  {Object.values(r.checklist).filter(Boolean).length} من{" "}
                  {CHECKLIST.length} بنود تحقق
                </small>
              </div>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setEditing(r.id);
                  setForm({ ...blank, ...(r as unknown as typeof blank) });
                }}
              >
                تعديل
              </button>
              <ConfirmDelete
                compact
                label={r.productName}
                onConfirm={() => saver.remove("evoAgencyReviews", r.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SkinPage({ view }: { view?: string }) {
  const { enabled } = useEvolution();
  if (!enabled("skin")) return <PillarOff label="البشرة" />;
  if (view === "agency") return <Agency />;
  return (
    <div className="evo-pillar-page">
      <div className="evo-pillar-intro">
        <div>
          <h2>رحلة البشرة</h2>
          <p className="muted">
            تجربة شخصية لمنتج وجه: ما استخدمته، ما لاحظته، وصور خاصة للمقارنة.
            لا تقييم آلي للبشرة.
          </p>
        </div>
        <Link href="/evolution/skin/agency" className="btn btn-secondary">
          <Briefcase size={16} /> التقييم التجاري المنفصل{" "}
          <ArrowLeft size={14} />
        </Link>
      </div>
      <Boundary>
        تختلف التجارب الفردية. الصور والملاحظات سجل شخصي ولا تثبت فعالية أو
        ملاءمة تجارية.
      </Boundary>
      <CareJournal pillar="skin" area="face" />
    </div>
  );
}
