import { requireUser, verifyPassword } from "@/lib/server/auth";
import { ApiError, withOwner } from "@/lib/server/db";
import { checkOrigin, fail, json, readBody } from "@/lib/server/http";
import { PILLAR_DATA } from "@/lib/server/evolution";
import { deletePillarData } from "@/lib/server/media";
export const runtime = "nodejs";
/** Per-pillar erasure. Password confirmation protects against accidental or hijacked deletes. */
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(request);
    const body = await readBody(request);
    if (body.action !== "delete-pillar")
      throw new ApiError("الإجراء غير معروف.");
    const plan = PILLAR_DATA[String(body.pillar)];
    if (!plan) throw new ApiError("القسم غير صالح.");
    await withOwner(user.id, () => verifyPassword(user.id, body.password));
    return json(await deletePillarData(user.id, plan));
  } catch (error) {
    return fail(error);
  }
}
