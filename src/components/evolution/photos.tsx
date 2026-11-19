"use client";
import { useMemo, useRef, useState } from "react";
import { Camera, Columns2, LoaderCircle, Lock, X } from "lucide-react";
import { useApp } from "../app-provider";
import { useToast } from "../ui";
import { ConfirmDelete, Empty, FormError } from "./shared";
import { dateLabel } from "@/lib/format";
import { cycleDay } from "@/lib/evolution";
import type { EvoPhoto } from "@/lib/types";

/**
 * Re-encode in the browser: drops EXIF/GPS, normalises orientation and caps size.
 * The server strips metadata again independently.
 */
async function reencode(
  file: File,
): Promise<{ blob: Blob; width: number; height: number }> {
  if (
    !/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) &&
    file.type !== ""
  )
    throw new Error("اختر صورة بصيغة JPEG أو PNG أو WebP.");
  if (file.size > 25 * 1024 * 1024)
    throw new Error("الصورة كبيرة جدًا قبل الضغط (الحد ٢٥ ميغابايت).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("تعذّر قراءة الصورة. جرّب صورة JPEG أو PNG.");
  }
  const max = 2048;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, "image/jpeg", 0.88),
  );
  if (!blob) throw new Error("تعذّر تجهيز الصورة.");
  return { blob, width, height };
}

export function PhotoTimeline({
  pillar,
  area,
  title,
  startDate,
  today,
}: {
  pillar: "skin" | "hair" | "fitness";
  area: "face" | "scalp" | "beard" | "body";
  title: string;
  startDate?: string;
  today: string;
}) {
  const { state, refresh } = useApp();
  const toast = useToast();
  const enabled = !!state?.capabilities?.privatePhotos;
  const photos = useMemo(
    () =>
      (state?.evoPhotos || [])
        .filter((p) => p.pillar === pillar && p.area === area)
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) ||
            a.createdAt.localeCompare(b.createdAt),
        ),
    [state?.evoPhotos, pillar, area],
  );
  const [date, setDate] = useState(today);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [split, setSplit] = useState(50);
  const fileRef = useRef<HTMLInputElement>(null);
  const label = (p: EvoPhoto) =>
    startDate ? `اليوم ${cycleDay(startDate, p.date)}` : dateLabel(p.date);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const { blob, width, height } = await reencode(file);
      const form = new FormData();
      // Neutral file name: the original name may identify the person.
      form.set("file", blob, "photo.jpg");
      form.set("pillar", pillar);
      form.set("area", area);
      form.set("date", date);
      form.set("caption", caption);
      form.set("width", String(width));
      form.set("height", String(height));
      const response = await fetch("/api/evolution/photos", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error || "تعذّر رفع الصورة. حاول مجددًا.");
      await refresh();
      setCaption("");
      toast("حُفظت الصورة بشكل خاص.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر رفع الصورة.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function remove(id: string) {
    const response = await fetch(`/api/evolution/photos/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!response.ok) {
      setError("تعذّر حذف الصورة.");
      return;
    }
    setSelected((s) => s.filter((x) => x !== id));
    await refresh();
    toast("حُذفت الصورة وملفها.");
  }
  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s.slice(-1), id],
    );
  const pair = selected
    .map((id) => photos.find((p) => p.id === id))
    .filter(Boolean) as EvoPhoto[];
  const [first, second] = [...pair].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return (
    <section className="evo-photos" aria-label={title}>
      <div className="evo-photos-head">
        <h3>{title}</h3>
        <span className="evo-private">
          <Lock size={13} aria-hidden="true" /> خاصة بك
        </span>
      </div>
      {!enabled ? (
        <p className="evo-locked">
          حفظ الصور الخاصة غير مفعّل في هذه الاستضافة بعد؛ يتطلب ترحيل قاعدة
          بيانات يوافق عليه صاحب المشروع. يمكنك متابعة الملاحظات النصية الآن.
        </p>
      ) : (
        <div className="evo-photo-upload">
          <p className="muted small">
            للمقارنة العادلة: الإضاءة نفسها، المسافة نفسها، وزاوية ثابتة. تُزال
            بيانات الموقع (EXIF) قبل الحفظ، ولا يوجد تحليل تلقائي للصور.
          </p>
          <div className="evo-grid-3">
            <label className="field">
              <span>تاريخ الصورة</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="field">
              <span>تعليق (اختياري)</span>
              <input
                value={caption}
                maxLength={300}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="خط الأساس، إضاءة النافذة…"
              />
            </label>
            <label
              className={`btn btn-secondary evo-file ${busy ? "busy" : ""}`}
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Camera size={16} />
              )}{" "}
              {busy ? "جارٍ الحفظ…" : "التقط أو اختر صورة"}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(e) => upload(e.target.files?.[0])}
                disabled={busy}
              />
            </label>
          </div>
          <FormError error={error} />
        </div>
      )}
      {photos.length === 0 ? (
        <Empty title="لا صور بعد">
          الصور اختيارية. الملاحظات المكتوبة كافية تمامًا.
        </Empty>
      ) : (
        <>
          <p className="muted small">
            اختر صورتين للمقارنة جنبًا إلى جنب على جهازك.
          </p>
          <ul className="evo-photo-grid">
            {photos.map((p) => (
              <li
                key={p.id}
                className={selected.includes(p.id) ? "selected" : ""}
              >
                <button
                  type="button"
                  className="evo-photo-thumb"
                  aria-pressed={selected.includes(p.id)}
                  onClick={() => toggle(p.id)}
                  aria-label={`اختيار صورة ${label(p)} للمقارنة`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/evolution/photos/${p.id}`}
                    alt={`صورة خاصة ${label(p)}${p.caption ? `: ${p.caption}` : ""}`}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
                <div className="evo-photo-meta">
                  <strong>{label(p)}</strong>
                  <small>{dateLabel(p.date)}</small>
                  {p.caption && <small>{p.caption}</small>}
                </div>
                {enabled && (
                  <ConfirmDelete
                    compact
                    label="الصورة"
                    onConfirm={() => remove(p.id)}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {first && second && (
        <div className="evo-compare" role="region" aria-label="مقارنة صورتين">
          <div className="evo-compare-head">
            <strong>
              <Columns2 size={16} aria-hidden="true" /> {label(first)} ←{" "}
              {label(second)}
            </strong>
            <button
              type="button"
              className="evo-icon-btn"
              aria-label="إغلاق المقارنة"
              onClick={() => setSelected([])}
            >
              <X size={16} />
            </button>
          </div>
          <div className="evo-compare-stage" dir="ltr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/evolution/photos/${second.id}`}
              alt={`لاحقًا: ${label(second)}`}
            />
            <div
              className="evo-compare-top"
              style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/evolution/photos/${first.id}`}
                alt={`سابقًا: ${label(first)}`}
              />
            </div>
            <span
              className="evo-compare-line"
              style={{ left: `${split}%` }}
              aria-hidden="true"
            />
          </div>
          <label className="field">
            <span>اسحب للمقارنة</span>
            <input
              type="range"
              min={0}
              max={100}
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
              aria-valuetext={`${split}%`}
            />
          </label>
          <p className="muted small">
            مقارنة شخصية فقط؛ لا تُعدّ دليلًا سريريًا أو إثباتًا لفعالية منتج.
          </p>
        </div>
      )}
    </section>
  );
}
