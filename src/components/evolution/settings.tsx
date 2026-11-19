"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Pause,
  Play,
  Archive,
  CheckCircle2,
  Download,
  Trash2,
} from "lucide-react";
import {
  useEvolution,
  useSaver,
  SectionTitle,
  Boundary,
  FormError,
} from "./shared";
import {
  PILLARS,
  PILLAR_LABELS,
  cycleEnd,
  isDay,
  type PillarKey,
} from "@/lib/evolution";
import { dateLabel } from "@/lib/format";
import { request } from "../app-provider";
import { Button, Modal } from "../ui";

const DELETE_TARGETS: { key: string; label: string }[] = [
  ...PILLARS.map((p) => ({ key: p, label: PILLAR_LABELS[p] })),
  { key: "agency", label: "التقييم التجاري" },
];

export default function EvoSettings() {
  const { cycle, refresh } = useEvolution();
  const saver = useSaver();
  const router = useRouter();
  const [goals, setGoals] = useState<string[]>(
    cycle?.goals.map((g) => g.title) || [],
  );
  const [startDate, setStartDate] = useState(cycle?.startDate || "");
  const [deleting, setDeleting] = useState<{
    key: string;
    label: string;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function erase() {
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await request("/api/evolution", {
        method: "POST",
        body: JSON.stringify({
          action: "delete-pillar",
          pillar: deleting!.key,
          password,
        }),
      });
      await refresh();
      setDeleting(null);
      setPassword("");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "تعذّر الحذف.");
    } finally {
      setDeleteBusy(false);
    }
  }
  return (
    <div className="evo-pillar-page">
      <div className="evo-pillar-intro">
        <div>
          <h2>إعدادات رحلتي</h2>
          <p className="muted">أهداف، أقسام، حالة الدورة، والخصوصية.</p>
        </div>
      </div>
      {cycle ? (
        <>
          <section className="evo-panel stack" aria-labelledby="goals-edit">
            <SectionTitle title="أهدافك (حتى ٣)" />
            {[0, 1, 2].map((i) => (
              <label key={i} className="field">
                <span>الهدف {i + 1}</span>
                <input
                  value={goals[i] || ""}
                  maxLength={300}
                  onChange={(e) =>
                    setGoals(Object.assign([...goals], { [i]: e.target.value }))
                  }
                />
              </label>
            ))}
            <Button
              loading={saver.busy}
              onClick={() =>
                saver.update(
                  "evoCycles",
                  cycle.id,
                  {
                    goals: goals
                      .map((t, i) => ({ id: cycle.goals[i]?.id, title: t }))
                      .filter((g) => g.title?.trim()),
                  },
                  "حُفظت أهدافك.",
                )
              }
            >
              احفظ الأهداف
            </Button>
          </section>
          <section className="evo-panel" aria-labelledby="pillars-edit">
            <SectionTitle
              title="الأقسام الظاهرة"
              kicker="الإخفاء لا يحذف السجلات"
            />
            <div className="evo-pillar-toggles">
              {PILLARS.map((p: PillarKey) => (
                <label
                  key={p}
                  className={`evo-toggle ${cycle.pillars[p] ? "on" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={cycle.pillars[p]}
                    onChange={(e) =>
                      saver.update(
                        "evoCycles",
                        cycle.id,
                        {
                          pillars: { ...cycle.pillars, [p]: e.target.checked },
                        },
                        e.target.checked
                          ? `أُظهر قسم ${PILLAR_LABELS[p]}.`
                          : `أُخفي قسم ${PILLAR_LABELS[p]}.`,
                      )
                    }
                  />
                  <span>
                    <strong>{PILLAR_LABELS[p]}</strong>
                  </span>
                </label>
              ))}
            </div>
          </section>
          <section className="evo-panel stack" aria-labelledby="cycle-edit">
            <SectionTitle
              title="الدورة"
              kicker={`من ${dateLabel(cycle.startDate)} إلى ${dateLabel(cycleEnd(cycle.startDate))}`}
            />
            <div className="evo-inline-add">
              <label className="field">
                <span>تعديل تاريخ البداية</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!isDay(startDate) || startDate === cycle.startDate}
                onClick={() =>
                  saver.update(
                    "evoCycles",
                    cycle.id,
                    { startDate },
                    "حُدّث تاريخ البداية. السجلات لم تتغير.",
                  )
                }
              >
                احفظ التاريخ
              </button>
            </div>
            <div className="evo-actions">
              {cycle.state === "active" && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    saver.update(
                      "evoCycles",
                      cycle.id,
                      { state: "paused" },
                      "أُوقفت الدورة مؤقتًا.",
                    )
                  }
                >
                  <Pause size={16} /> إيقاف مؤقت
                </button>
              )}
              {(cycle.state === "paused" || cycle.state === "draft") && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    saver.update(
                      "evoCycles",
                      cycle.id,
                      { state: "active" },
                      "الدورة نشطة.",
                    )
                  }
                >
                  <Play size={16} />{" "}
                  {cycle.state === "draft" ? "ابدأ الدورة" : "استئناف"}
                </button>
              )}
              {cycle.state !== "draft" && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    saver.update(
                      "evoCycles",
                      cycle.id,
                      { state: "completed" },
                      "اكتملت الدورة. يمكنك أرشفتها وبدء دورة جديدة.",
                    )
                  }
                >
                  <CheckCircle2 size={16} /> إنهاء الدورة
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  if (
                    await saver.update(
                      "evoCycles",
                      cycle.id,
                      { state: "archived" },
                      "أُرشفت الدورة وبقي سجلها محفوظًا.",
                    )
                  )
                    router.push("/evolution/onboarding");
                }}
              >
                <Archive size={16} /> أرشفة وبدء دورة جديدة
              </button>
            </div>
            <p className="muted small">
              الإيقاف المؤقت لا يغيّر أرقام الأيام أو تواريخ الصور. الأرشفة تحفظ
              التاريخ للقراءة فقط.
            </p>
          </section>
        </>
      ) : (
        <section className="evo-panel">
          <p>لا توجد دورة مفتوحة.</p>
          <Link className="btn btn-primary" href="/evolution/onboarding">
            ابدأ دورة جديدة
          </Link>
        </section>
      )}
      <FormError error={saver.error} />
      <section className="evo-panel stack" aria-labelledby="privacy-edit">
        <SectionTitle title="الخصوصية والبيانات" />
        <Boundary>
          بيانات هذا القسم حساسة (صور، مكمّلات، يوميات). لا مشاركة ولا تحليل AI.
          التصدير يشمل كل سجلات رحلتك وصورك الخاصة، ويتطلب كلمة المرور.
        </Boundary>
        <Link href="/settings/privacy" className="btn btn-secondary">
          <Download size={16} /> تصدير كل بياناتي
        </Link>
        <h3>حذف قسم بالكامل</h3>
        <p className="muted small">
          يحذف كل سجلات القسم وصوره نهائيًا من كل الدورات. لا يمكن التراجع.
        </p>
        <div className="evo-chips">
          {DELETE_TARGETS.map((t) => (
            <button
              key={t.key}
              type="button"
              className="evo-chip danger"
              onClick={() => setDeleting(t)}
            >
              <Trash2 size={13} /> {t.label}
            </button>
          ))}
        </div>
      </section>
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`حذف بيانات ${deleting?.label || ""}`}
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            erase();
          }}
        >
          <p>
            سيُحذف كل ما يخص «{deleting?.label}» نهائيًا، بما في ذلك الصور. أكّد
            بكلمة المرور.
          </p>
          <label className="field">
            <span>كلمة المرور</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <FormError error={deleteError} />
          <Button type="submit" variant="danger" loading={deleteBusy}>
            احذف نهائيًا
          </Button>
        </form>
      </Modal>
    </div>
  );
}
