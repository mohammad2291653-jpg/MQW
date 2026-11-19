import { requireUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/db";
import {
  checkOrigin,
  fail,
  json,
  limitedBytes,
  rateLimit,
} from "@/lib/server/http";
import { PHOTO_FILE_LIMIT, savePhoto } from "@/lib/server/media";
export const runtime = "nodejs";
const active = new Set<string>();
export async function POST(request: Request) {
  let owner: string | undefined;
  try {
    checkOrigin(request);
    const user = await requireUser(request);
    rateLimit(`photo:${user.id}`, 20);
    if (active.has(user.id))
      throw new ApiError("هناك صورة قيد الحفظ. انتظر اكتمالها.", 429);
    active.add(user.id);
    owner = user.id;
    const raw = await limitedBytes(request, PHOTO_FILE_LIMIT + 64 * 1024);
    let data: FormData;
    try {
      data = await new Request(request.url, {
        method: "POST",
        headers: { "content-type": request.headers.get("content-type") || "" },
        body: raw as BodyInit,
      }).formData();
    } catch {
      throw new ApiError("بيانات الصورة غير صالحة.");
    }
    const file = data.get("file");
    if (!(file instanceof File)) throw new ApiError("اختر صورة.");
    const photo = await savePhoto(
      user.id,
      Buffer.from(await file.arrayBuffer()),
      {
        pillar: data.get("pillar"),
        area: data.get("area"),
        date: data.get("date"),
        caption: data.get("caption"),
        width: data.get("width"),
        height: data.get("height"),
      },
    );
    return json(photo, 201);
  } catch (error) {
    return fail(error);
  } finally {
    if (owner) active.delete(owner);
  }
}
