import { requireUser } from "@/lib/server/auth";
import { transaction } from "@/lib/server/db";
import { checkOrigin, fail, json, readBody } from "@/lib/server/http";
import { palaceAction } from "@/lib/server/palace";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = requireUser(request);
    const body = await readBody(request);
    return json(transaction(() => palaceAction(user.id, body)));
  } catch (error) {
    return fail(error);
  }
}
