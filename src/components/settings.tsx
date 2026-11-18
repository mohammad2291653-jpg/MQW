"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Bell,
  Check,
  ChevronLeft,
  Download,
  EarOff,
  Globe2,
  Info,
  KeyRound,
  LockKeyhole,
  Mic,
  MonitorSmartphone,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Volume2,
  WandSparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp, request } from "./app-provider";
import { Button, Modal, PageHeader, useToast } from "./ui";
const tabs = [
  ["preferences", "تفضيلاتك", Settings2],
  ["account", "الحساب", UserRound],
  ["privacy", "الخصوصية والبيانات", ShieldCheck],
  ["notifications", "الإشعارات", Bell],
  ["appearance", "المظهر والوصول", MonitorSmartphone],
  ["voice", "التسجيلات الصوتية", Mic],
  ["ai", "الذكاء الاصطناعي", Sparkles],
] as const;
export default function SettingsPage({ section = [] }: { section?: string[] }) {
  const { state, user, savePreferences, refresh, authenticate } = useApp(),
    toast = useToast(),
    router = useRouter();
  const tab = section[0] || "preferences";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(false),
    [exporting, setExporting] = useState(false),
    [password, setPassword] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  if (!state || !user) return null;
  async function preferences(values: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await savePreferences(values);
      toast("حُفظت تفضيلاتك.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await request("/api/account", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: f.get("currentPassword"),
          newPassword: f.get("newPassword"),
        }),
      });
      form.reset();
      toast("تغيّرت كلمة المرور وأُغلقت الجلسات السابقة.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportData(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "تعذّر التصدير");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mqw-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExporting(false);
      setPassword("");
      toast("نُزّلت نسخة بياناتك، وتشمل التسجيلات الأصلية المرمّزة داخل الملف.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{
        deleted: boolean;
        filesDeletionPending: boolean;
      }>("/api/account", {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      router.replace(
        result.filesDeletionPending
          ? "/sign-up?deletion=pending"
          : "/sign-up?deletion=complete",
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function enableNotification(
    kind: "deadlineNotifications" | "habitReminder",
    enabled: boolean,
  ) {
    if (enabled) {
      if (!("Notification" in window)) {
        setError(
          "هذا المتصفح لا يدعم إشعارات النظام. تبقى المواعيد داخل التطبيق.",
        );
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("لم يُمنح إذن الإشعارات. يمكنك متابعة كل المواعيد داخل MQW.");
        return;
      }
    }
    await preferences({ [kind]: enabled });
  }
  return (
    <div className="settings-page">
      <PageHeader
        eyebrow="مساحتك، بطريقتك"
        title="أنت صاحب القرار."
        description="تفضيلات واضحة. وحدود خصوصية تستطيع التحكم بها."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="أقسام الإعدادات">
          {tabs.map(([id, label, Icon]) => (
            <Link
              key={id}
              href={`/settings/${id}`}
              className={tab === id ? "active" : ""}
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronLeft size={14} />
            </Link>
          ))}
        </nav>
        <div className="settings-body">
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          {tab === "preferences" && (
            <>
              <div className="settings-section">
                <h2>تفضيلات التعلّم</h2>
                <p className="muted">
                  قيم بداية قابلة للتعديل، وليست أحكامًا ثابتة عنك.
                </p>
                <form
                  className="stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    preferences({
                      timezone: f.get("timezone"),
                      studyMinutes: Number(f.get("studyMinutes")),
                    });
                  }}
                >
                  <label className="field">
                    <span>منطقتك الزمنية</span>
                    <select
                      name="timezone"
                      defaultValue={state.preferences.timezone}
                    >
                      {[
                        "Asia/Hebron",
                        "Asia/Jerusalem",
                        "Asia/Amman",
                        "Asia/Riyadh",
                        "Asia/Dubai",
                        "Africa/Cairo",
                        "Europe/London",
                        "Europe/Berlin",
                        "America/New_York",
                        "Etc/UTC",
                      ].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <small>
                      تُعرض المراجعات بتوقيتك، مع التعامل مع التوقيت الصيفي.
                    </small>
                  </label>
                  <label className="field">
                    <span>مدة الدراسة الافتراضية</span>
                    <select
                      name="studyMinutes"
                      defaultValue={state.preferences.studyMinutes}
                    >
                      {[15, 25, 45, 60, 90, 120].map((m) => (
                        <option key={m} value={m}>
                          {m} دقيقة
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button loading={busy}>احفظ تفضيلاتي</Button>
                </form>
              </div>
              <div className="settings-section">
                <h2>ما نعتمده في البداية</h2>
                <ul className="plain-list">
                  <li>الأولويات حسب الأهمية، مع حرية تغييرها.</li>
                  <li>الأفكار تبقى ملاحظات حتى تحولها بنفسك إلى مهام.</li>
                  <li>
                    أمثلة الأحياء عينات تعليمية أصلية، وليست مقررك الجامعي.
                  </li>
                  <li>لا استبيان طويل، ولا تصنيف لـ«نمط تعلّم» ثابت.</li>
                </ul>
              </div>
            </>
          )}
          {tab === "account" && (
            <>
              <div className="settings-section">
                <h2>حسابك الخاص</h2>
                <div className="account-profile">
                  <span className="large-avatar">
                    {(user.name || user.email)[0]}
                  </span>
                  <div>
                    <strong>{user.name || "مساحتي"}</strong>
                    <p dir="ltr">{user.email}</p>
                  </div>
                  <span className="pill">
                    <LockKeyhole size={12} /> حساب خاص
                  </span>
                </div>
                <p className="info-message">
                  النسخة الحالية تحفظ البيانات في قاعدة محلية على خادم التطبيق.
                  لم تُربط خدمة بريد أو مزامنة سحابية.
                </p>
              </div>
              <div className="settings-section">
                <h2>تغيير كلمة المرور</h2>
                <form className="stack" onSubmit={changePassword}>
                  <label className="field">
                    <span>كلمة المرور الحالية</span>
                    <input
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>كلمة المرور الجديدة</span>
                    <input
                      name="newPassword"
                      type="password"
                      minLength={10}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                    />
                    <small>
                      10 أحرف على الأقل. تُلغى الجلسات السابقة بعد التغيير.
                    </small>
                  </label>
                  <Button loading={busy}>
                    تغيير كلمة المرور <KeyRound size={16} />
                  </Button>
                </form>
              </div>
            </>
          )}
          {tab === "privacy" && (
            <>
              <div className="settings-section">
                <span className="pill">
                  <ShieldCheck size={13} /> خصوصيتك جزء من الأساس
                </span>
                <h2>ما يُستخدم، وما يبقى خارج التحليل</h2>
                <p>
                  الاختبارات والمراجعات والجلسات المحفوظة تدعم تقدمك الواقعي.
                  نصوص الملاحظات واليوميات والتسجيلات والمراجعة الأسبوعية لا
                  تدخل في الاستنتاجات.
                </p>
                <div className="setting-row">
                  <div>
                    <strong>الملاحظات الشخصية الاختيارية</strong>
                    <p>
                      اسمح بعرض ملاحظات مستندة إلى أرقام تعلمك. إيقافها لا يحذف
                      سجل الاختبارات ولا يوقف المراجعات.
                    </p>
                  </div>
                  <Toggle
                    checked={state.preferences.personalization}
                    disabled={busy}
                    label="الملاحظات الشخصية الاختيارية"
                    onChange={(v) => preferences({ personalization: v })}
                  />
                </div>
                <div className="privacy-boundaries">
                  <span>
                    <Check size={16} /> لا إعلانات أو تتبع خارجي
                  </span>
                  <span>
                    <Check size={16} /> لا تشخيصات أو استنتاج مزاج
                  </span>
                  <span>
                    <Check size={16} /> AI الخارجي غير مفعّل
                  </span>
                </div>
              </div>
              <div className="settings-section">
                <h2>بياناتك ملكك</h2>
                <div className="setting-row">
                  <div>
                    <strong>تصدير بياناتي</strong>
                    <p>
                      ملف JSON يتضمن تفضيلاتك ومحاولاتك ومراجعاتك وقصرك ومحتواك.
                      يشمل التسجيلات الأصلية بترميز base64 داخل الملف.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setExporting(true);
                      setPassword("");
                      setError("");
                    }}
                  >
                    <Download size={17} /> تصدير
                  </Button>
                </div>
                <div className="setting-row danger-row">
                  <div>
                    <strong>حذف الحساب والبيانات</strong>
                    <p>
                      حذف دائم من قاعدة التطبيق وملفاته، بعد التحقق من كلمة
                      المرور.
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setDeleting(true);
                      setPassword("");
                      setConfirmed(false);
                      setError("");
                    }}
                  >
                    <Trash2 size={17} /> حذف الحساب
                  </Button>
                </div>
                <p className="muted small">
                  لا ندّعي تشفيرًا بين الطرفين. سياسة النسخ الاحتياطية السحابية
                  تُحدّد عند اختيار الاستضافة.
                </p>
              </div>
            </>
          )}
          {tab === "appearance" && (
            <div className="settings-section">
              <h2>واجهة تتناسب معك</h2>
              <div className="appearance-preview">
                <div />
                <div />
                <span>عربي أولًا. ضوء ومساحة.</span>
              </div>
              <p>
                المظهر الفاتح هو التصميم الأساسي. تتبع الواجهة اتجاه RTL، مع
                الحفاظ على ترتيب المصطلحات الإنجليزية.
              </p>
              <div className="setting-row">
                <div>
                  <strong>تقليل الحركة</strong>
                  <p>
                    انتقالات هادئة دون حركة مكانية أو مؤثرات غير ضرورية. نحترم
                    أيضًا إعداد نظامك.
                  </p>
                </div>
                <Toggle
                  checked={state.preferences.reducedMotion}
                  disabled={busy}
                  label="تقليل الحركة"
                  onChange={(v) => preferences({ reducedMotion: v })}
                />
              </div>
              <p className="muted">
                يمكنك تكبير النص من المتصفح، واستخدام لوحة المفاتيح للتنقل.
              </p>
            </div>
          )}
          {tab === "notifications" && (
            <div className="settings-section">
              <h2>تذكير يساعد، دون ضغط</h2>
              <p className="info-message">
                تعمل تنبيهات هذه النسخة أثناء فتح التطبيق فقط، وبعد إذنك. لا
                توجد خدمة Push تعمل في الخلفية.
              </p>
              <div className="setting-row">
                <div>
                  <strong>المواعيد المهمة</strong>
                  <p>
                    تنبيه عام عند حلول يوم مهمة مهمة، دون عرض محتواها على شاشة
                    القفل.
                  </p>
                </div>
                <Toggle
                  checked={state.preferences.deadlineNotifications}
                  disabled={busy}
                  label="تنبيهات المواعيد المهمة"
                  onChange={(v) =>
                    enableNotification("deadlineNotifications", v)
                  }
                />
              </div>
              <div className="setting-row">
                <div>
                  <strong>تذكير عادة واحد</strong>
                  <p>
                    مرة واحدة كحد أقصى في اليوم عند فتح التطبيق. الراحة اختيار
                    صالح دائمًا.
                  </p>
                </div>
                <Toggle
                  checked={state.preferences.habitReminder}
                  disabled={busy}
                  label="تذكير عادة واحد"
                  onChange={(v) => enableNotification("habitReminder", v)}
                />
              </div>
              <p className="muted">
                رفض الإذن لا يخفي مراجعاتك أو مواعيدك داخل التطبيق.
              </p>
            </div>
          )}
          {tab === "voice" && (
            <div className="settings-section">
              <h2>صوتك، دون تحليل خفي</h2>
              <p>
                لا يبدأ التسجيل قبل طلبك وإذن الميكروفون. تستطيع الاستماع والحفظ
                والحذف. لا تفريغ أو ترجمة أو تلخيص تلقائي.
              </p>
              <div className="voice-summary">
                <Mic size={28} />
                <strong>{state.voiceAssets.length} تسجيلات محفوظة</strong>
              </div>
              <Link className="btn btn-secondary" href="/space/voice">
                إدارة تسجيلاتي <ChevronLeft size={16} />
              </Link>
              <p className="muted">
                التسجيلات خاصة، وتُحمّل عبر جلسة حسابك. قد يختلف دعم التسجيل حسب
                المتصفح.
              </p>
            </div>
          )}
          {tab === "ai" && (
            <div className="settings-section ai-settings">
              <span className="ai-symbol">
                <Sparkles size={31} />
              </span>
              <span className="pill">غير متصل · متوقف افتراضيًا</span>
              <h2>التعلّم يعمل دون AI خارجي.</h2>
              <p>
                كل الدروس والاختبارات والمراجعات والقصر والتقدم تعمل بقواعد
                داخلية. لا يوجد مزود خارجي مربوط، ولا طلبات AI تُرسل من التطبيق.
              </p>
              <div className="ai-flow">
                <span>غرض محدد</span>
                <ChevronLeft size={14} />
                <span>معاينة الحمولة والمستلم</span>
                <ChevronLeft size={14} />
                <span>موافقة لكل إرسال</span>
              </div>
              <p className="muted">
                عند إضافة مزود مستقبلًا، تُعرض التكلفة وسياسة البيانات قبل
                الاستخدام. ملاحظاتك وصوتك ومحتواك غير المرتبط لا تُرفق تلقائيًا.
              </p>
            </div>
          )}
        </div>
      </div>
      <Modal
        open={exporting}
        onClose={() => {
          setExporting(false);
          setError("");
        }}
        title="نسخة من بياناتك"
      >
        <form className="stack" onSubmit={exportData}>
          <p>يحتوي الملف محتواك الخاص. احتفظ به في مكان آمن.</p>
          <label className="field">
            <span>أكّد كلمة المرور</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Button type="submit" loading={busy}>
            <Download size={17} /> تنزيل بياناتي
          </Button>
        </form>
      </Modal>
      <Modal
        open={deleting}
        onClose={() => {
          setDeleting(false);
          setError("");
        }}
        title="حذف الحساب نهائيًا"
      >
        <form className="stack" onSubmit={deleteAccount}>
          <p>
            سيُحذف سجل تعلمك وقصرك وملاحظاتك ومهامك وتسجيلاتك من التطبيق. لا يمكن
            التراجع عن هذه الخطوة.
          </p>
          <label className="field">
            <span>كلمة المرور الحالية</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            أفهم أن الحذف دائم.
          </label>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="danger"
            loading={busy}
            disabled={!confirmed}
          >
            احذف حسابي وبياناتي
          </Button>
        </form>
      </Modal>
    </div>
  );
}
function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span />
    </button>
  );
}
