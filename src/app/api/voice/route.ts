import { requireUser } from "@/lib/server/auth";
import {
  checkOrigin,
  fail,
  json,
  rateLimit,
  limitedBytes,
} from "@/lib/server/http";
import { ApiError } from "@/lib/server/db";
import { saveVoice, writeVoice } from "@/lib/server/voice";
export const runtime = "nodejs";
const activeUploads = new Set<string>();
export async function POST(request: Request) {
  let uploadingUser: string | undefined;
  try {
    checkOrigin(request);
    const user = await requireUser(request);
    rateLimit(`voice:${user.id}`, 10);
    if (activeUploads.has(user.id))
      throw new ApiError(
        "هناك تسجيل قيد الحفظ. انتظر اكتماله ثم حاول مجددًا.",
        429,
      );
    activeUploads.add(user.id);
    uploadingUser = user.id;
    if (Number(request.headers.get("content-length") || 0) > 21 * 1024 * 1024)
      throw new ApiError("التسجيل أكبر من الحجم المسموح.", 413);
    const raw = await limitedBytes(request, 21 * 1024 * 1024);
    const bounded = new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") || "" },
      body: raw as BodyInit,
    });
    let data: FormData;
    try {
      data = await bounded.formData();
    } catch {
      throw new ApiError("بيانات التسجيل غير صالحة.");
    }
    const file = data.get("file");
    if (!(file instanceof File)) throw new ApiError("اختر تسجيلًا صوتيًا.");
    const values = await saveVoice(
      user.id,
      file,
      String(data.get("title") || ""),
      Number(data.get("duration") || 0),
    );
    const buffer = Buffer.from(await file.arrayBuffer());
    return json(await writeVoice(user.id, values, buffer), 201);
  } catch (error) {
    return fail(error);
  } finally {
    if (uploadingUser) activeUploads.delete(uploadingUser);
  }
}
