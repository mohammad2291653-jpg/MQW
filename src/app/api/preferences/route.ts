import { requireUser } from "@/lib/server/auth";
import { checkOrigin, fail, json, readBody } from "@/lib/server/http";
import { transaction, withOwner } from "@/lib/server/db";
import { patchPreferences } from "@/lib/server/records";
export const runtime = "nodejs";
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(request);
    const body = await readBody(request);
    return json(
      await withOwner(user.id, () =>
        transaction(async () => patchPreferences(user.id, body)),
      ),
    );
  } catch (error) {
    return fail(error);
  }
}
