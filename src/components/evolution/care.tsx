"use client";
import { useState } from "react";
import { Plus, AlertTriangle, PackageOpen } from "lucide-react";
import {
  useEvolution,
  useSaver,
  FormError,
  SectionTitle,
  ConfirmDelete,
  Empty,
  Boundary,
  Scale,
} from "./shared";
import { PhotoTimeline } from "./photos";
import { dateLabel } from "@/lib/format";
import type { EvoArea, EvoProduct } from "@/lib/types";
import { Button, Modal } from "../ui";

const AREA_LABEL: Record<EvoArea, string> = {
  face: "الوجه",
  scalp: "فروة الرأس",
  beard: "اللحية",
};
const PRODUCT_STATUS: Record<EvoProduct["status"], string> = {
  active: "قيد الاستخدام",
  paused: "متوقف مؤقتًا",
  discontinued: "أوقفته",
};

function ProductForm({
  pillar,
  area,
  product,
  onDone,
}: {
  pillar: "skin" | "hair";
  area: EvoArea;
  product?: EvoProduct;
  onDone: () => void;
}) {
  const saver = useSaver();
  const [v, setV] = useState({
    name: product?.name || "",
    brand: product?.brand || "",
    strengthAsLabelled: product?.strengthAsLabelled || "",
    ingredients: product?.ingredients || "",
    labelInstructions: product?.labelInstructions || "",
    clinicianNote: product?.clinicianNote || "",
    patchTestNote: product?.patchTestNote || "",
    source: product?.source || "",
    url: product?.url || "",
    size: product?.size || "",
    status: product?.status || "active",
  });
  const set =
    (k: keyof typeof v) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setV({ ...v, [k]: e.target.value });
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = product
          ? await saver.update("evoProducts", product.id, {
              ...v,
              pillar,
              area,
            })
          : await saver.create(
              "evoProducts",
              { ...v, pillar, area },
              "أُضيف المنتج إلى سجلك.",
            );
        if (ok) onDone();
      }}
    >
      <div className="evo-grid-2">
        <label className="field">
          <span>اسم المنتج</span>
          <input
            value={v.name}
            onChange={set("name")}
            required
            maxLength={200}
          />
        </label>
        <label className="field">
          <span>العلامة / المصنّع</span>
          <input value={v.brand} onChange={set("brand")} maxLength={200} />
        </label>
      </div>
      <label className="field">
        <span>التركيز كما هو مكتوب على العبوة (إن وُجد)</span>
        <input
          value={v.strengthAsLabelled}
          onChange={set("strengthAsLabelled")}
          maxLength={100}
          placeholder="انسخه من العبوة أو الوصفة؛ لا نقترح قيمة"
        />
      </label>
      <label className="field">
        <span>المكوّنات (كما تكتبها أو من مصدر موثّق)</span>
        <textarea
          rows={2}
          value={v.ingredients}
          onChange={set("ingredients")}
          maxLength={5000}
        />
      </label>
      <label className="field">
        <span>تعليمات الاستخدام كما وردت على الملصق</span>
        <textarea
          rows={2}
          value={v.labelInstructions}
          onChange={set("labelInstructions")}
          maxLength={3000}
        />
      </label>
      <label className="field">
        <span>تعليمات المختص (إن وُجدت)</span>
        <textarea
          rows={2}
          value={v.clinicianNote}
          onChange={set("clinicianNote")}
          maxLength={3000}
        />
      </label>
      <div className="evo-grid-2">
        <label className="field">
          <span>ملاحظة اختبار التحسس (اختياري)</span>
          <input
            value={v.patchTestNote}
            onChange={set("patchTestNote")}
            maxLength={1000}
          />
        </label>
        <label className="field">
          <span>الحالة</span>
          <select value={v.status} onChange={set("status")}>
            {Object.entries(PRODUCT_STATUS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="evo-grid-3">
        <label className="field">
          <span>الحجم</span>
          <input value={v.size} onChange={set("size")} maxLength={100} />
        </label>
        <label className="field">
          <span>المصدر</span>
          <input value={v.source} onChange={set("source")} maxLength={300} />
        </label>
        <label className="field">
          <span>رابط (اختياري)</span>
          <input
            type="url"
            dir="ltr"
            value={v.url}
            onChange={set("url")}
            maxLength={1000}
          />
        </label>
      </div>
      <p className="muted small">
        التطبيق لا يتحقق من سلامة المنتج ولا يقترح جرعة أو تكرارًا.
      </p>
      <FormError error={saver.error} />
      <Button type="submit" loading={saver.busy}>
        {product ? "احفظ التعديل" : "أضف المنتج"}
      </Button>
    </form>
  );
}

export function CareJournal({
  pillar,
  area,
}: {
  pillar: "skin" | "hair";
  area: EvoArea;
}) {
  const { state, today, cycle } = useEvolution();
  const saver = useSaver();
  const products = state.evoProducts.filter(
    (p) => p.pillar === pillar && p.area === area,
  );
  const events = state.evoRoutineEvents
    .filter((e) => e.pillar === pillar && e.area === area)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  const observations = state.evoObservations
    .filter((o) => o.pillar === pillar && o.area === area)
    .sort((a, b) => b.date.localeCompare(a.date));
  const [productModal, setProductModal] = useState<EvoProduct | "new" | null>(
    null,
  );
  const [ev, setEv] = useState({
    productId: "",
    date: today,
    time: "",
    status: "done",
    irritation: false,
    notes: "",
  });
  const [ob, setOb] = useState({
    productId: "",
    date: today,
    narrative: "",
    irritation: false,
    rating: null as number | null,
    useRating: false,
  });
  const [mn, setMn] = useState({
    date: today,
    notes: "",
    irritation: false,
    confirmed: false,
  });
  const productName = (id?: string | null) =>
    id
      ? products.find((p) => p.id === id)?.name ||
        state.evoProducts.find((p) => p.id === id)?.name ||
        "منتج محذوف"
      : "";
  const recentIrritation = [...events, ...observations].some(
    (x) => x.irritation && x.date >= today.slice(0, 8) + "01",
  );

  return (
    <div className="evo-care">
      {recentIrritation && (
        <Boundary tone="care" title="سجّلت تهيّجًا محتملًا">
          يمكنك تسجيل إيقاف مؤقت أو نهائي للمنتج. راجع ملصق المنتج، واستشر مختصًا
          مؤهلًا إذا استمر التهيّج أو كان مقلقًا. التطبيق لا يقترح علاجًا.
        </Boundary>
      )}
      <section
        className="evo-panel"
        aria-labelledby={`${pillar}-${area}-products`}
      >
        <SectionTitle
          title={`منتجات ${AREA_LABEL[area]}`}
          kicker="سجل منتجاتك"
          action={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setProductModal("new")}
            >
              <Plus size={16} /> منتج
            </button>
          }
        />
        {products.length === 0 ? (
          <Empty title="لم تضف منتجًا بعد">
            أضف المنتج كما هو على عبوته. لا نملأ أي تركيز أو جرعة تلقائيًا.
          </Empty>
        ) : (
          <ul className="evo-list">
            {products.map((p) => (
              <li key={p.id}>
                <PackageOpen size={18} aria-hidden="true" />
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {[
                      p.brand,
                      p.strengthAsLabelled &&
                        `على العبوة: ${p.strengthAsLabelled}`,
                      PRODUCT_STATUS[p.status],
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  {p.labelInstructions && (
                    <small className="evo-quote">
                      الملصق: {p.labelInstructions}
                    </small>
                  )}
                </div>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setProductModal(p)}
                >
                  تعديل
                </button>
                <ConfirmDelete
                  compact
                  label={p.name}
                  onConfirm={() => saver.remove("evoProducts", p.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="evo-two-col">
        <section
          className="evo-panel"
          aria-labelledby={`${pillar}-${area}-log`}
        >
          <SectionTitle title="سجل الاستخدام" kicker="ما فعلته فعلًا" />
          <form
            className="stack evo-compact-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await saver.create(
                "evoRoutineEvents",
                {
                  pillar,
                  area,
                  kind: "application",
                  ...ev,
                  productId: ev.productId || null,
                  cycleId: cycle?.id,
                },
                "سُجّل الاستخدام.",
              );
              if (ok) setEv({ ...ev, notes: "", irritation: false });
            }}
          >
            <div className="evo-grid-2">
              <label className="field">
                <span>المنتج</span>
                <select
                  value={ev.productId}
                  onChange={(e) => setEv({ ...ev, productId: e.target.value })}
                >
                  <option value="">بدون منتج محدد</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>الحالة</span>
                <select
                  value={ev.status}
                  onChange={(e) => setEv({ ...ev, status: e.target.value })}
                >
                  <option value="done">استخدمته</option>
                  <option value="skipped">تخطّيت</option>
                  <option value="paused">أوقفت مؤقتًا</option>
                  <option value="discontinued">أوقفت نهائيًا</option>
                </select>
              </label>
              <label className="field">
                <span>التاريخ</span>
                <input
                  type="date"
                  value={ev.date}
                  onChange={(e) => setEv({ ...ev, date: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>الوقت (اختياري)</span>
                <input
                  type="time"
                  value={ev.time}
                  onChange={(e) => setEv({ ...ev, time: e.target.value })}
                />
              </label>
            </div>
            <label className="evo-check">
              <input
                type="checkbox"
                checked={ev.irritation}
                onChange={(e) => setEv({ ...ev, irritation: e.target.checked })}
              />{" "}
              لاحظت تهيّجًا أو انزعاجًا محتملًا
            </label>
            <label className="field">
              <span>ملاحظة (اختياري)</span>
              <input
                value={ev.notes}
                onChange={(e) => setEv({ ...ev, notes: e.target.value })}
                maxLength={3000}
              />
            </label>
            <Button type="submit" loading={saver.busy}>
              سجّل
            </Button>
          </form>
          <ul className="evo-timeline">
            {events
              .filter((e) => e.kind === "application")
              .slice(0, 12)
              .map((e) => (
                <li key={e.id}>
                  <time>
                    {dateLabel(e.date, undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </time>
                  <span>
                    {productName(e.productId) || "استخدام"} ·{" "}
                    {
                      {
                        done: "استُخدم",
                        skipped: "تخطٍّ",
                        paused: "إيقاف مؤقت",
                        discontinued: "إيقاف نهائي",
                      }[e.status]
                    }
                    {e.irritation && (
                      <em className="evo-flag">
                        <AlertTriangle size={13} aria-hidden="true" /> تهيّج
                        محتمل
                      </em>
                    )}
                  </span>
                  <ConfirmDelete
                    compact
                    label="السجل"
                    onConfirm={() => saver.remove("evoRoutineEvents", e.id)}
                  />
                </li>
              ))}
          </ul>
        </section>

        <section
          className="evo-panel"
          aria-labelledby={`${pillar}-${area}-obs`}
        >
          <SectionTitle title="ملاحظاتك" kicker="بكلماتك أنت" />
          <form
            className="stack evo-compact-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await saver.create(
                "evoObservations",
                {
                  pillar,
                  area,
                  date: ob.date,
                  narrative: ob.narrative,
                  irritation: ob.irritation,
                  productId: ob.productId || null,
                  rating: ob.useRating ? ob.rating : null,
                  cycleId: cycle?.id,
                },
                "حُفظت الملاحظة.",
              );
              if (ok)
                setOb({
                  ...ob,
                  narrative: "",
                  irritation: false,
                  rating: null,
                });
            }}
          >
            <label className="field">
              <span>ماذا لاحظت؟</span>
              <textarea
                rows={3}
                value={ob.narrative}
                onChange={(e) => setOb({ ...ob, narrative: e.target.value })}
                required
                maxLength={5000}
                placeholder="جفاف أقل حول الأنف، احمرار خفيف بعد الاستخدام…"
              />
            </label>
            <div className="evo-grid-2">
              <label className="field">
                <span>التاريخ</span>
                <input
                  type="date"
                  value={ob.date}
                  onChange={(e) => setOb({ ...ob, date: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>مرتبطة بمنتج؟</span>
                <select
                  value={ob.productId}
                  onChange={(e) => setOb({ ...ob, productId: e.target.value })}
                >
                  <option value="">لا</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="evo-check">
              <input
                type="checkbox"
                checked={ob.irritation}
                onChange={(e) => setOb({ ...ob, irritation: e.target.checked })}
              />{" "}
              تهيّج أو أثر جانبي محتمل
            </label>
            <label className="evo-check">
              <input
                type="checkbox"
                checked={ob.useRating}
                onChange={(e) => setOb({ ...ob, useRating: e.target.checked })}
              />{" "}
              أريد إضافة تقدير شخصي (اختياري)
            </label>
            {ob.useRating && (
              <Scale
                label="تقديرك الشخصي للحالة اليوم"
                value={ob.rating}
                onChange={(r) => setOb({ ...ob, rating: r })}
                low="أسوأ"
                high="أفضل"
              />
            )}
            <Button type="submit" loading={saver.busy}>
              احفظ الملاحظة
            </Button>
          </form>
          <ul className="evo-timeline">
            {observations.slice(0, 12).map((o) => (
              <li key={o.id}>
                <time>
                  {dateLabel(o.date, undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </time>
                <span>
                  {o.narrative}
                  {o.irritation && (
                    <em className="evo-flag">
                      <AlertTriangle size={13} aria-hidden="true" /> تهيّج محتمل
                    </em>
                  )}
                </span>
                <ConfirmDelete
                  compact
                  label="الملاحظة"
                  onConfirm={() => saver.remove("evoObservations", o.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
      <FormError error={saver.error} />

      {pillar === "hair" && (
        <section
          className="evo-panel evo-clinical"
          aria-labelledby={`mn-${area}`}
        >
          <SectionTitle
            title="جلسات الوخز الدقيق (Dermaroller)"
            kicker="فقط بخطة من مختص سريري"
          />
          <Boundary tone="care" title="لا يُنشئ التطبيق أي بروتوكول">
            لا نقدّم عمق إبر أو تكرارًا أو توقيتًا أو دمجًا مع منتجات. الوخز قد يسبب
            تهيّجًا أو جروحًا أو عدوى. هذا سجل لجلسات حدّدها مختص، وليس دليل
            استخدام.
          </Boundary>
          <form
            className="stack evo-compact-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!mn.confirmed)
                return saver.setError(
                  "أكّد أن الجلسة ضمن خطة وضعها مختص سريري.",
                );
              const ok = await saver.create(
                "evoRoutineEvents",
                {
                  pillar,
                  area,
                  kind: "microneedling",
                  clinicianEstablished: true,
                  date: mn.date,
                  irritation: mn.irritation,
                  notes: mn.notes,
                  cycleId: cycle?.id,
                },
                "سُجّلت الجلسة.",
              );
              if (ok)
                setMn({
                  ...mn,
                  notes: "",
                  irritation: false,
                  confirmed: false,
                });
            }}
          >
            <div className="evo-grid-2">
              <label className="field">
                <span>تاريخ الجلسة</span>
                <input
                  type="date"
                  value={mn.date}
                  onChange={(e) => setMn({ ...mn, date: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>ملاحظات (اختياري)</span>
                <input
                  value={mn.notes}
                  onChange={(e) => setMn({ ...mn, notes: e.target.value })}
                  maxLength={3000}
                />
              </label>
            </div>
            <label className="evo-check">
              <input
                type="checkbox"
                checked={mn.irritation}
                onChange={(e) => setMn({ ...mn, irritation: e.target.checked })}
              />{" "}
              تهيّج أو نزف أو انزعاج بعد الجلسة
            </label>
            <label className="evo-check">
              <input
                type="checkbox"
                checked={mn.confirmed}
                onChange={(e) => setMn({ ...mn, confirmed: e.target.checked })}
              />{" "}
              هذه الجلسة ضمن خطة وضعها مختص سريري
            </label>
            <Button type="submit" variant="secondary" loading={saver.busy}>
              سجّل الجلسة
            </Button>
          </form>
          <ul className="evo-timeline">
            {events
              .filter((e) => e.kind === "microneedling")
              .map((e) => (
                <li key={e.id}>
                  <time>
                    {dateLabel(e.date, undefined, {
                      day: "numeric",
                      month: "short",
                    })}
                  </time>
                  <span>
                    جلسة بخطة مختص {e.notes && `· ${e.notes}`}
                    {e.irritation && (
                      <em className="evo-flag">
                        <AlertTriangle size={13} aria-hidden="true" /> تهيّج
                      </em>
                    )}
                  </span>
                  <ConfirmDelete
                    compact
                    label="الجلسة"
                    onConfirm={() => saver.remove("evoRoutineEvents", e.id)}
                  />
                </li>
              ))}
          </ul>
        </section>
      )}

      <PhotoTimeline
        pillar={pillar}
        area={area}
        title={`صور ${AREA_LABEL[area]} الخاصة`}
        startDate={cycle?.startDate}
        today={today}
      />

      <Modal
        open={!!productModal}
        onClose={() => setProductModal(null)}
        title={productModal === "new" ? "منتج جديد" : "تعديل المنتج"}
      >
        {productModal && (
          <ProductForm
            pillar={pillar}
            area={area}
            product={productModal === "new" ? undefined : productModal}
            onDone={() => setProductModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
