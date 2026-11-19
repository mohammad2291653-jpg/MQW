"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useApp } from "./app-provider";
import TodayPage from "./today";
import AuthPage from "./auth";
import LearnPage from "./learn";
import PalacePage from "./palace";
import SpacePage from "./space";
import ProgressPage from "./progress";

// The five primary destinations stay in the main bundle (fastest first paint).
// Secondary and heavy screens — MQW 90, the lesson player, reviews, study,
// settings and onboarding — are separate chunks, prefetched when the browser is idle.
function PageLoading() {
  return (
    <div className="page-skeleton" aria-label="جارٍ التحميل" role="status">
      <span />
      <span />
      <span />
      <p>نفتح الصفحة…</p>
    </div>
  );
}
const LessonPlayer = dynamic(() => import("./lesson-player"), {
  loading: PageLoading,
});
const ReviewsPage = dynamic(() => import("./reviews"), {
  loading: PageLoading,
});
const StudyPage = dynamic(() => import("./study"), { loading: PageLoading });
const SettingsPage = dynamic(() => import("./settings"), {
  loading: PageLoading,
});
const Onboarding = dynamic(() => import("./onboarding"), {
  loading: PageLoading,
});
const EvolutionPage = dynamic(() => import("./evolution/evolution"), {
  loading: PageLoading,
});
const secondary: Record<string, () => Promise<unknown>> = {
  reviews: () => import("./reviews"),
  study: () => import("./study"),
  settings: () => import("./settings"),
  onboarding: () => import("./onboarding"),
  evolution: () => import("./evolution/evolution"),
};
if (typeof window !== "undefined") {
  const [first, second] = window.location.pathname.split("/").filter(Boolean);
  // A direct visit to a secondary screen starts its chunk immediately…
  const now =
    first === "learn" && second
      ? () => import("./lesson-player")
      : secondary[first];
  now?.().catch(() => undefined);
}
/** After the first real content paint, fetch the remaining screens when idle. */
function usePrefetchSecondary(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const idle = () => {
      for (const load of [
        ...Object.values(secondary),
        () => import("./lesson-player"),
      ])
        load().catch(() => undefined);
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: object) => number;
    };
    const timer = setTimeout(
      () =>
        w.requestIdleCallback
          ? w.requestIdleCallback(idle, { timeout: 4000 })
          : idle(),
      2000,
    );
    return () => clearTimeout(timer);
  }, [ready]);
}
export default function RouterView({ path }: { path: string[] }) {
  usePrefetchSecondary(!!useApp().state);
  const [root, ...rest] = path;
  if (
    ["sign-in", "sign-up", "forgot-password", "reset-password"].includes(root)
  )
    return (
      <AuthPage
        mode={
          root as "sign-in" | "sign-up" | "forgot-password" | "reset-password"
        }
      />
    );
  switch (root) {
    case "today":
      return <TodayPage />;
    case "learn":
      return rest[0] ? <LessonPlayer slug={rest[0]} /> : <LearnPage />;
    case "reviews":
      return <ReviewsPage />;
    case "study":
      return <StudyPage />;
    case "palace":
      return <PalacePage path={rest} />;
    case "space":
      return <SpacePage section={rest} />;
    case "progress":
      return <ProgressPage section={rest} />;
    case "settings":
      return <SettingsPage section={rest} />;
    case "evolution":
      return <EvolutionPage path={rest} />;
    case "onboarding":
      return <Onboarding />;
    default:
      return (
        <div className="empty-state">
          <h1>هذه الصفحة غير موجودة</h1>
          <p>يمكنك العودة إلى مساحتك ومتابعة التعلم.</p>
          <Link href="/today" className="btn btn-primary">
            العودة إلى اليوم
          </Link>
        </div>
      );
  }
}
