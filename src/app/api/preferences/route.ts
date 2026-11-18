import { requireUser } from "@/lib/server/auth";
import { checkOrigin, fail, json, readBody } from "@/lib/server/http";
import { patchPreferences } from "@/lib/server/records";
export const runtime = "nodejs";
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const user = requireUser(request);
    return json(patchPreferences(user.id, await readBody(request)));
  } catch (error) {
    return fail(error);
  }
}
