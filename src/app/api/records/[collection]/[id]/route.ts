import { requireUser } from "@/lib/server/auth";
import { checkOrigin, fail, json, readBody } from "@/lib/server/http";
import { patchRecord, removeRecord } from "@/lib/server/records";
import { transaction } from "@/lib/server/db";
export const runtime = "nodejs";
type Context = { params: Promise<{ collection: string; id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = requireUser(request);
    const { collection, id } = await params;
    const body = await readBody(request);
    return json(transaction(() => patchRecord(user.id, collection, id, body)));
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = requireUser(request);
    const { collection, id } = await params;
    return json(transaction(() => removeRecord(user.id, collection, id)));
  } catch (error) {
    return fail(error);
  }
}
