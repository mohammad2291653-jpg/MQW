import { requireUser } from "@/lib/server/auth";
import { checkOrigin, fail, json, readBody } from "@/lib/server/http";
import { patchRecord, removeRecord } from "@/lib/server/records";
import { transaction, withOwner } from "@/lib/server/db";
export const runtime = "nodejs";
type Context = { params: Promise<{ collection: string; id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser(request);
    const { collection, id } = await params;
    const body = await readBody(request);
    return json(
      await withOwner(user.id, () =>
        transaction(async () => patchRecord(user.id, collection, id, body)),
      ),
    );
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    checkOrigin(request);
    const user = await requireUser(request);
    const { collection, id } = await params;
    return json(
      await withOwner(user.id, () =>
        transaction(async () => removeRecord(user.id, collection, id)),
      ),
    );
  } catch (error) {
    return fail(error);
  }
}
