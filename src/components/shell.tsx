"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  House,
  BookOpen,
  Castle,
  Layers2,
  ChartNoAxesCombined,
  Settings2,
  ArrowUpLeft,
  ShieldCheck,
  Search,
  Bell,
  X,
  ChevronLeft,
  LogOut,
  Sun,
  Menu,
  LoaderCircle,
} from "lucide-react";
import { useApp } from "./app-provider";
import { ForegroundNotifications } from "./foreground-notifications";
import { IconButton, Modal, useToast } from "./ui";
import { dateLabel } from "@/lib/format";
const nav = [
  { href: "/today", name: "اليوم", en: "TODAY", icon: House },
  { href: "/learn", name: "تعلّم", en: "LEARN", icon: BookOpen },
  { href: "/palace", name: "قصري", en: "PALACE", icon: Castle },
  { href: "/space", name: "مساحتي", en: "MY SPACE", icon: Layers2 },
  {
    href: "/progress",
    name: "تقدّمي",
    en: "PROGRESS",
    icon: ChartNoAxesCombined,
  },
];
function active(href: string, path: string) {
  return (
    path.startsWith(href) ||
    (href === "/learn" && /^\/(reviews|study)/.test(path))
  );
}
export function Shell({ children }: { children: React.ReactNode }) {
  const { user, state, loading, error, refresh, authenticate } = useApp(),
    path = usePathname(),
    router = useRouter();
  const [search, setSearch] = useState(false),
    [query, setQuery] = useState(""),
    [notifications, setNotifications] = useState(false);
  const toast = useToast();
  async function logout() {
    try {
      await authenticate("sign-out");
      router.replace("/sign-in");
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذّر تسجيل الخروج. حاول مجددًا.");
    }
  }
  const isPublic = [
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
  ].some((p) => path.startsWith(p));
  useEffect(() => {
    if (!loading && !user && !isPublic && !error) router.replace("/sign-in");
  }, [loading, user, isPublic, router, error]);
  useEffect(() => {
    document.documentElement.classList.toggle(
      "reduce-motion",
      !!state?.preferences.reducedMotion,
    );
  }, [state?.preferences.reducedMotion]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  if (isPublic) return <>{children}</>;
  if (loading)
    return (
      <div className="boot-screen">
        <div className="brand-mark">m</div>
        <p>لحظة لنفتح مساحتك…</p>
        <LoaderCircle className="spin" size={22} />
      </div>
    );
  if (error && !state)
    return (
      <div className="boot-screen">
        <ShieldCheck size={36} />
        <h1>تعذّر فتح مساحتك</h1>
        <p>{error}</p>
        <button
          className="btn btn-primary"
          onClick={() => refresh().catch(() => {})}
        >
          إعادة المحاولة
        </button>
      </div>
    );
  if (!user || !state)
    return (
      <div className="boot-screen">
        <LoaderCircle className="spin" />
        <p>جارٍ الانتقال إلى تسجيل الدخول…</p>
      </div>
    );
  const current = nav.find((n) => active(n.href, path));
  const due = state.reviews.filter((r) => new Date(r.dueAt) <= new Date());
  const results = query.trim()
    ? [
        ...state.notes.map((n) => ({
          id: n.id,
          title: n.title || n.text.slice(0, 50),
          href: n.journal ? `/space/journal/${n.id}` : `/space/notes/${n.id}`,
          type: n.journal ? "يوميات" : "ملاحظة",
        })),
        ...state.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          href: `/space/tasks/${t.id}`,
          type: "مهمة",
        })),
        ...nav.map((n) => ({
          id: n.href,
          title: n.name,
          href: n.href,
          type: "صفحة",
        })),
      ]
        .filter((x) => x.title.includes(query.trim()))
        .slice(0, 8)
    : [];
  return (
    <div className="app-layout">
      <ForegroundNotifications />
      <a className="skip-link" href="#main">
        انتقل إلى المحتوى
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/today" aria-label="MQW — اليوم">
          <span className="brand-mark">m</span>
          <span>
            <strong dir="ltr">
              MQW<span className="brand-dot">.</span>
            </strong>
            <small>تعلّم أفضل. عِش بوعي.</small>
          </span>
        </Link>
        <p className="nav-label">مساحتك اليومية</p>
        <nav className="side-navigation" aria-label="التنقل الرئيسي">
          {nav.map(({ href, name, en, icon: Icon }) => (
            <Link
              href={href}
              key={href}
              className={`nav-item ${active(href, path) ? "active" : ""}`}
              aria-current={active(href, path) ? "page" : undefined}
            >
              <Icon size={21} strokeWidth={1.7} />
              <span>{name}</span>
              {active(href, path) && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="little-spark">✳</span>
            <p>
              خطوة صغيرة،
              <br />
              <strong>تعلّم يبقى.</strong>
            </p>
            <span className="muted">على مهلك، هذه رحلتك.</span>
          </div>
          <Link
            href="/settings"
            className={`nav-item ${path.startsWith("/settings") ? "active" : ""}`}
          >
            <Settings2 size={20} />
            <span>الإعدادات</span>
          </Link>
          <button className="nav-item sign-out" onClick={logout}>
            <LogOut size={19} />
            <span>تسجيل الخروج</span>
          </button>
          <div className="privacy-caption">
            <ShieldCheck size={13} /> خاصة بك، وتحت سيطرتك
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="desktop-only">مساحتك</span>
            <ChevronLeft size={13} className="desktop-only" />
            <span>
              {current?.name ||
                (path.startsWith("/settings") ? "الإعدادات" : "مرحبًا بك")}
            </span>
          </div>
          <div className="topbar-tools">
            <span className="topbar-date">
              <Sun size={15} />
              {dateLabel(new Date(), state.preferences.timezone)}
            </span>
            <IconButton label="البحث في مساحتك" onClick={() => setSearch(true)}>
              <Search size={20} />
            </IconButton>
            <div className="notification-wrap">
              <IconButton
                label={`المراجعات المستحقة: ${due.length}`}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={20} />
                {due.length > 0 && <span className="notification-dot" />}
              </IconButton>
              {notifications && (
                <div className="notification-popover">
                  <strong>مراجعاتك</strong>
                  <p>
                    {due.length
                      ? `لديك ${due.length} مراجعة متاحة الآن.`
                      : "لا توجد مراجعات مستحقة الآن."}
                  </p>
                  {due.length > 0 && (
                    <Link
                      href="/reviews"
                      onClick={() => setNotifications(false)}
                    >
                      افتح المراجعات <ArrowUpLeft size={15} />
                    </Link>
                  )}
                </div>
              )}
            </div>
            <div className="topbar-divider" />
            <Link
              href="/settings/account"
              className="user-avatar"
              title={user.name || user.email}
            >
              {(user.name || user.email).charAt(0)}
            </Link>
          </div>
        </header>
        <main id="main" className="page-content">
          {error && (
            <div role="alert" className="error-banner">
              {error}{" "}
              <button onClick={() => refresh().catch(() => {})}>
                إعادة الاتصال
              </button>
            </div>
          )}
          {children}
        </main>
        <footer className="main-footer">
          <span dir="ltr">MQW — Learn better. Live intentionally.</span>
          <span>
            <ShieldCheck size={12} /> مساحتك. بخطوتك أنت.
          </span>
        </footer>
      </div>
      <nav className="mobile-navigation" aria-label="التنقل الرئيسي للهاتف">
        {nav.map(({ href, name, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={active(href, path) ? "active" : ""}
            aria-current={active(href, path) ? "page" : undefined}
          >
            <Icon size={21} />
            <span>{name}</span>
          </Link>
        ))}
      </nav>
      <Modal
        open={search}
        onClose={() => setSearch(false)}
        title="ابحث في مساحتك"
      >
        <div className="field">
          <input
            type="search"
            placeholder="ملاحظة، مهمة، أو صفحة…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            aria-label="عبارة البحث"
          />
        </div>
        <div className="search-results">
          {results.map((r) => (
            <Link
              href={r.href}
              key={r.id}
              onClick={() => {
                setSearch(false);
                setQuery("");
              }}
            >
              <span>{r.title}</span>
              <small>{r.type}</small>
            </Link>
          ))}
          {query && !results.length && (
            <p className="muted">لا توجد نتائج لهذا البحث.</p>
          )}
          {!query && (
            <p className="muted">
              البحث داخل مساحتك فقط. لا يُرسل محتواك إلى AI.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
