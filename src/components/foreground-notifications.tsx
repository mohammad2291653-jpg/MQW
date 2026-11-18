"use client";
import { useEffect } from "react";
import { useApp } from "./app-provider";
import { localDay } from "@/lib/format";
// Foreground only. No background push or invisible permission requests.
export function ForegroundNotifications() {
  const { user, state } = useApp();
  useEffect(() => {
    if (
      !user ||
      !state ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    function check() {
      if (document.visibilityState !== "visible" || !state || !user) return;
      try {
        const day = localDay(state.preferences.timezone);
        if (state.preferences.deadlineNotifications) {
          for (const task of state.tasks.filter(
            (t) =>
              !t.done &&
              t.importance >= 3 &&
              t.dueDate &&
              t.dueDate.slice(0, 10) <= day,
          )) {
            const key = `mqw-notification:${user.id}:task:${task.id}:${day}`;
            if (!localStorage.getItem(key)) {
              new Notification("موعد مهم في مساحتك", {
                body: "افتح MQW للاطلاع على المواعيد التي اخترتها.",
                icon: "/icon.svg",
                tag: key,
              });
              localStorage.setItem(key, "shown");
            }
          }
        }
        if (
          state.preferences.habitReminder &&
          state.habits.some((h) => !h.logs[day])
        ) {
          const key = `mqw-notification:${user.id}:habit:${day}`;
          if (!localStorage.getItem(key)) {
            new Notification("مساحة صغيرة لعادتك", {
              body: "إن أحببت، اختر إنجازًا أو راحة لهذا اليوم.",
              icon: "/icon.svg",
              tag: key,
            });
            localStorage.setItem(key, "shown");
          }
        }
      } catch {
        /* Unsupported notification or denied browser storage must not interrupt learning. */
      }
    }
    check();
    const timer = setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [user, state]);
  return null;
}
