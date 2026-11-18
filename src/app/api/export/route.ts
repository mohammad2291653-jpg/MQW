import { requireUser, verifyPassword } from "@/lib/server/auth";
import { getState, db } from "@/lib/server/db";
import { fail, rateLimit, checkOrigin, readBody } from "@/lib/server/http";
import { readVoice } from "@/lib/server/voice";
export const runtime = "nodejs";
export async function GET() {
  return Response.json(
    { error: "تصدير البيانات يتطلب تأكيد كلمة المرور." },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = requireUser(request);
    const body = await readBody(request);
    verifyPassword(user.id, body.password);
    rateLimit(`export:${user.id}`, 3);
    const state = getState(user.id);
    const ownedSnapshots = (
      db
        .prepare(
          "SELECT id,collection,secret FROM records WHERE user_id=? AND secret!='{}'",
        )
        .all(user.id) as { id: string; collection: string; secret: string }[]
    ).map((r) => ({
      id: r.id,
      collection: r.collection,
      snapshot: JSON.parse(r.secret),
    }));
    const voiceFiles = state.voiceAssets.map((asset) => {
      try {
        return {
          id: asset.id,
          mimeType: asset.mimeType,
          encoding: "base64",
          content: readVoice(user.id, asset.id).bytes.toString("base64"),
        };
      } catch {
        return { id: asset.id, error: "الملف غير متاح محليًا" };
      }
    });
    return new Response(
      JSON.stringify(
        {
          schemaVersion: "mqw-export-1",
          exportedAt: new Date().toISOString(),
          user,
          state,
          ownedSnapshots,
          voiceFiles,
        },
        null,
        2,
      ),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": 'attachment; filename="mqw-export.json"',
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    return fail(error);
  }
}
