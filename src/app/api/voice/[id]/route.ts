import { requireUser } from "@/lib/server/auth";
import { checkOrigin, fail, json } from "@/lib/server/http";
import { readVoice, removeVoice } from "@/lib/server/voice";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const { asset, bytes } = await readVoice(user.id, id);
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser(request);
    const { id } = await params;
    return json(await removeVoice(user.id, id));
  } catch (error) {
    return fail(error);
  }
}
