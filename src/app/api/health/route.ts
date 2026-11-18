/** Public readiness only: never return account, environment, path or version details. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET() {
  try {
    const { db } = await import("@/lib/server/db");
    db.prepare("SELECT 1 FROM users LIMIT 1").get();
    return Response.json({ data: { status: "ok" } }, { headers });
  } catch {
    return Response.json(
      { data: { status: "unavailable" } },
      { status: 503, headers },
    );
  }
}
