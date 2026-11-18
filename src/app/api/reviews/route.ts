import { requireUser } from "@/lib/server/auth";
import { checkOrigin, fail, json, readBody } from "@/lib/server/http";
import { transaction } from "@/lib/server/db";
import { reviewsAction } from "@/lib/server/learning";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = requireUser(request);
    const body = await readBody(request);
    return json(transaction(() => reviewsAction(user.id, body)));
  } catch (error) {
    return fail(error);
  }
}
