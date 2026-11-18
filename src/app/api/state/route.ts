import { requireUser } from "@/lib/server/auth";
import { getState, withOwner } from "@/lib/server/db";
import { fail, json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return json(await withOwner(user.id, () => getState(user.id)));
  } catch (error) {
    return fail(error);
  }
}
