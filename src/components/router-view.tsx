"use client";
import Link from "next/link";
import TodayPage from "./today";
import AuthPage from "./auth";
import LearnPage from "./learn";
import LessonPlayer from "./lesson-player";
import ReviewsPage from "./reviews";
import StudyPage from "./study";
import PalacePage from "./palace";
import SpacePage from "./space";
import ProgressPage from "./progress";
import SettingsPage from "./settings";
import Onboarding from "./onboarding";
export default function RouterView({ path }: { path: string[] }) {
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
