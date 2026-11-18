"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="empty-state">
      <h1>توقفت هذه الصفحة للحظة</h1>
      <p>محاولاتك المحفوظة باقية. يمكنك إعادة المحاولة.</p>
      <button className="btn btn-primary" onClick={reset}>
        إعادة المحاولة
      </button>
    </div>
  );
}
