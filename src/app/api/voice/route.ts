import { requireUser } from "@/lib/server/auth";
import {
  checkOrigin,
  fail,
  json,
  rateLimit,
  limitedBytes,
} from "@/lib/server/http";
import { ApiError, transaction } from "@/lib/server/db";
import { saveVoice, writeVoice } from "@/lib/server/voice";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = requireUser(request);
    rateLimit(`voice:${user.id}`, 10);
    if (Number(request.headers.get("content-length") || 0) > 21 * 1024 * 1024)
      throw new ApiError("التسجيل أكبر من الحجم المسموح.", 413);
    const raw = await limitedBytes(request, 21 * 1024 * 1024);
    const bounded = new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") || "" },
      body: raw as BodyInit,
    });
    const data = await bounded.formData();
    const file = data.get("file");
    if (!(file instanceof File)) throw new ApiError("اختر تسجيلًا صوتيًا.");
    const values = saveVoice(
      user.id,
      file,
      String(data.get("title") || ""),
      Number(data.get("duration") || 0),
    );
    const buffer = Buffer.from(await file.arrayBuffer());
    return json(
      transaction(() => writeVoice(user.id, values, buffer)),
      201,
    );
  } catch (error) {
    return fail(error);
  }
}
