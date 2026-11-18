import { requireUser } from "@/lib/server/auth";
import { checkOrigin, fail, json, readBody } from "@/lib/server/http";
import { createRecord } from "@/lib/server/records";
import { transaction } from "@/lib/server/db";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ collection: string }> },
) {
  try {
    checkOrigin(request);
    const user = requireUser(request);
    const { collection } = await params;
    const body = await readBody(request);
    return json(
      transaction(() => createRecord(user.id, collection, body)),
      201,
    );
  } catch (error) {
    return fail(error);
  }
}
