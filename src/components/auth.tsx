"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useApp, request } from "./app-provider";
import { Button } from "./ui";
import { LearningArt } from "./art";
export default function AuthPage({
  mode = "sign-in",
}: {
  mode?: "sign-in" | "sign-up" | "forgot-password" | "reset-password";
}) {
  const { authenticate } = useApp(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [visible, setVisible] = useState(false),
    [notice, setNotice] = useState("");
  const [registration, setRegistration] = useState<
    "open" | "invite" | "closed" | null
  >(null);
  const [setupToken, setSetupToken] = useState("");
  useEffect(() => {
    let active = true;
    try {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const token = fragment.get("setup");
      if (token && token.length <= 4096) {
        sessionStorage.setItem("mqw.setup", token);
        history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      }
      setSetupToken(sessionStorage.getItem("mqw.setup") || "");
    } catch {
      /* Storage restrictions never expose the invite or bypass its server check. */
    }
    request<{ capabilities?: { registration: "open" | "invite" | "closed" } }>(
      "/api/auth",
    )
      .then((result) => {
        if (active)
          setRegistration(result.capabilities?.registration || "closed");
      })
      .catch(() => {
        if (active)
          setError("تعذّر التحقق من حالة الحساب. حدّث الصفحة للمحاولة مجددًا.");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("deletion");
    if (status === "pending")
      setNotice(
        "أُغلق الحساب وحُذفت سجلاته. حذف بعض الملفات ما زال قيد الاستكمال؛ يحتفظ الخادم بطلب تنظيف يعاد عند تشغيله.",
      );
    else if (status === "complete")
      setNotice("حُذف الحساب وسجلاته وملفاته من التطبيق.");
  }, []);
  const signingUp = mode === "sign-up",
    reset = mode === "forgot-password" || mode === "reset-password";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      if (reset) {
        await request("/api/auth", {
          method: "POST",
          body: JSON.stringify({
            action: "forgot-password",
            email: form.get("email"),
          }),
        });
        setNotice(
          "إن كان البريد مسجّلًا، ستصلك تعليمات الاستعادة عند تهيئة خدمة البريد.",
        );
      } else {
        await authenticate(mode, {
          email: form.get("email"),
          password: form.get("password"),
          name: form.get("name") || "",
          ...(mode === "sign-up" ? { setupToken } : {}),
        });
        if (mode === "sign-up") {
          try {
            sessionStorage.removeItem("mqw.setup");
          } catch {}
        }
        router.push("/today");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-form-side">
        <Link className="brand" href="/sign-in">
          <span className="brand-mark">m</span>
          <strong dir="ltr">
            MQW<span className="brand-dot">.</span>
          </strong>
        </Link>
        <div className="auth-form-inner">
          <p className="eyebrow">
            <span className="tiny-dot" /> مساحة شخصية. إمكانيات أكبر.
          </p>
          <h1>
            {reset
              ? "استعد الوصول لمساحتك"
              : signingUp
                ? "بداية صغيرة،\nتغيير يبقى."
                : "أهلًا بعودتك\nإلى مساحتك."}
          </h1>
          <p className="muted">
            {reset
              ? "أدخل بريد حسابك لطلب تعليمات الاستعادة."
              : signingUp
                ? "مساحتك الخاصة لتتعلّم بعمق، وتتذكّر بثقة، وتعيش بوعي."
                : "ما تعلّمته ينتظرك. لنكمل من حيث وصلت، على مهلك."}
          </p>
          <form onSubmit={submit} className="auth-form">
            {signingUp && registration === "closed" && (
              <p className="info-message" role="status">
                إنشاء حساب جديد مغلق لهذه المساحة الخاصة. إن كنت صاحب الحساب،
                سجّل الدخول.
              </p>
            )}
            {signingUp && registration === "invite" && (
              <p className="info-message">
                هذه مساحة شخصية. استخدم رابط الإعداد الخاص بك لإنشاء حسابك
                الأول.
              </p>
            )}
            {signingUp && (
              <label className="field">
                <span>بماذا نُناديك؟</span>
                <input
                  name="name"
                  placeholder="اسمك الأول"
                  maxLength={60}
                  autoComplete="given-name"
                  required
                />
              </label>
            )}
            <label className="field">
              <span>البريد الإلكتروني</span>
              <input
                name="email"
                type="email"
                dir="ltr"
                placeholder="you@example.com"
                required
                autoComplete="email"
                maxLength={254}
              />
            </label>
            {!reset && (
              <label className="field">
                <span>كلمة المرور</span>
                <div className="password-field">
                  <input
                    name="password"
                    type={visible ? "text" : "password"}
                    dir="ltr"
                    placeholder={
                      signingUp ? "10 أحرف على الأقل" : "أدخل كلمة المرور"
                    }
                    minLength={signingUp ? 10 : 1}
                    maxLength={128}
                    required
                    autoComplete={
                      signingUp ? "new-password" : "current-password"
                    }
                  />
                  <button
                    type="button"
                    aria-label={
                      visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                    }
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}
            {signingUp && registration === "invite" && !setupToken && (
              <label className="field">
                <span>رمز الإعداد الخاص</span>
                <input
                  type="password"
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                  autoComplete="off"
                  required
                  maxLength={4096}
                />
                <small>
                  يُستخدم مرة واحدة. لا تضعه في رابط عام أو ترسله لأي شخص.
                </small>
              </label>
            )}
            {!signingUp && !reset && (
              <Link className="forgot-link" href="/forgot-password">
                نسيت كلمة المرور؟
              </Link>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="info-message" role="status">
                {notice}
              </p>
            )}
            <Button
              type="submit"
              loading={busy}
              disabled={
                signingUp &&
                (registration === null ||
                  registration === "closed" ||
                  (registration === "invite" && !setupToken))
              }
            >
              {reset
                ? "طلب الاستعادة"
                : signingUp
                  ? "أنشئ مساحتك"
                  : "ادخل إلى مساحتك"}{" "}
              <ArrowLeft size={18} />
            </Button>
          </form>
          <p className="auth-switch">
            {reset ? (
              <Link href="/sign-in">العودة لتسجيل الدخول</Link>
            ) : signingUp ? (
              <>
                لديك حساب بالفعل؟ <Link href="/sign-in">تسجيل الدخول</Link>
              </>
            ) : (
              <>
                هذه زيارتك الأولى؟ <Link href="/sign-up">أنشئ حسابك</Link>
              </>
            )}
          </p>
          <div className="auth-privacy">
            <ShieldCheck size={17} />
            <span>بياناتك خاصة. لا إعلانات، ولا تحليل خارجي خفي.</span>
          </div>
        </div>
        <span className="auth-bottom" dir="ltr">
          LEARN BETTER. LIVE INTENTIONALLY.
        </span>
      </div>
      <div className="auth-art-side">
        <span className="auth-art-badge">
          <Sparkles size={15} /> تعلّم كيف تتعلّم
        </span>
        <LearningArt />
        <h2>
          المعرفة التي تستدعيها،
          <br />
          هي المعرفة التي تبقى.
        </h2>
        <p>
          افهم. جرّب. استرجع.
          <br />
          وابنِ طريقتك، خطوة بخطوة.
        </p>
        <div className="auth-feature-row">
          <span>تعلّم تفاعلي</span>
          <i />
          <span>قصر ذاكرة</span>
          <i />
          <span>رؤى من أدلتك</span>
        </div>
      </div>
    </div>
  );
}
