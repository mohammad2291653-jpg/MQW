import { requireUser } from "@/lib/server/auth";
import { checkOrigin, fail, json, readBody } from "@/lib/server/http";
import { readPhoto, removePhoto, updatePhotoCaption } from "@/lib/server/media";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
/** Owner-only streaming; never cached, never a public or long-lived link. */
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const { photo, bytes } = await readPhoto(user.id, id);
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": photo.mimeType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser(request);
    const { id } = await params;
    const body = await readBody(request);
    return json(await updatePhotoCaption(user.id, id, body.caption, body.date));
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser(request);
    const { id } = await params;
    return json(await removePhoto(user.id, id));
  } catch (error) {
    return fail(error);
  }
}
