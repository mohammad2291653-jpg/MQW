import { requireUser } from "@/lib/server/auth";
import { getState } from "@/lib/server/db";
import { fail, json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    return json(getState(requireUser(request).id));
  } catch (error) {
    return fail(error);
  }
}
