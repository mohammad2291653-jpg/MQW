import { requireUser } from "@/lib/server/auth";
import { checkOrigin, fail, json } from "@/lib/server/http";
import { transaction } from "@/lib/server/db";
import { readVoice, removeVoice } from "@/lib/server/voice";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const user = requireUser(request);
    const { id } = await params;
    const { asset, bytes } = readVoice(user.id, id);
    return new Response(bytes, {
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
    const user = requireUser(request);
    const { id } = await params;
    return json(transaction(() => removeVoice(user.id, id)));
  } catch (error) {
    return fail(error);
  }
}
