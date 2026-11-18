import { constants } from "node:fs";
import { open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import type { ReadStream } from "node:fs";
import { requireUser, verifyPassword } from "@/lib/server/auth";
import { getState, db, transaction } from "@/lib/server/db";
import { fail, rateLimit, checkOrigin, readBody } from "@/lib/server/http";
import { voicePath } from "@/lib/server/voice";
import type { VoiceAsset } from "@/lib/types";
export const runtime = "nodejs";

/** The generator is pulled by the consumer; it never buffers the audio archive. */
async function* voiceJson(
  userId: string,
  asset: VoiceAsset,
): AsyncGenerator<string> {
  let handle: FileHandle | undefined;
  let before;
  try {
    if (
      !Number.isSafeInteger(asset.size) ||
      asset.size < 1 ||
      asset.size > 20 * 1024 * 1024
    )
      throw new Error("invalid size");
    handle = await open(
      voicePath(userId, asset.id),
      constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
    );
    before = await handle.stat();
    if (!before.isFile() || before.size !== asset.size)
      throw new Error("unavailable file");
  } catch {
    await handle?.close().catch(() => {});
    yield JSON.stringify({
      id: asset.id,
      error: "الملف غير متاح محليًا أو تغيّر منذ حفظ بياناته",
    });
    return;
  }
  let file: ReadStream | undefined;
  try {
    yield (
      JSON.stringify({
        id: asset.id,
        mimeType: asset.mimeType,
        encoding: "base64",
      }).slice(0, -1) + ',"content":"'
    );
    let carry = Buffer.alloc(0);
    let total = 0;
    let complete = false;
    try {
      file = handle.createReadStream({
        highWaterMark: 64 * 1024,
        start: 0,
        end: asset.size - 1,
        autoClose: false,
      });
      for await (const chunk of file) {
        const bytes = carry.length
          ? Buffer.concat([carry, chunk as Buffer])
          : (chunk as Buffer);
        total += (chunk as Buffer).length;
        const boundary = bytes.length - (bytes.length % 3);
        if (boundary) yield bytes.subarray(0, boundary).toString("base64");
        carry = Buffer.from(bytes.subarray(boundary));
      }
      const after = await handle.stat();
      complete =
        total === asset.size &&
        after.size === before.size &&
        after.mtimeMs === before.mtimeMs &&
        after.ino === before.ino;
    } catch {
      // Preserve valid JSON and identify a partial file rather than implying a complete export.
    }
    if (carry.length) yield carry.toString("base64");
    yield complete
      ? '\"}'
      : '\",\"complete\":false,\"error\":\"تعذّر إكمال قراءة التسجيل؛ أعد التصدير\"}';
  } finally {
    file?.destroy();
    await handle.close().catch(() => {});
  }
}
async function* exportJson(
  prefix: string,
  userId: string,
  assets: VoiceAsset[],
): AsyncGenerator<string> {
  yield prefix;
  for (let index = 0; index < assets.length; index++) {
    if (index) yield ",";
    yield* voiceJson(userId, assets[index]);
  }
  yield "]}";
}
export async function GET() {
  return Response.json(
    { error: "تصدير البيانات يتطلب تأكيد كلمة المرور." },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = requireUser(request);
    const body = await readBody(request);
    verifyPassword(user.id, body.password);
    rateLimit(`export:${user.id}`, 3);
    const { state, ownedSnapshots } = transaction(() => ({
      state: getState(user.id),
      ownedSnapshots: (
        db
          .prepare(
            "SELECT id,collection,secret FROM records WHERE user_id=? AND secret!='{}'",
          )
          .all(user.id) as { id: string; collection: string; secret: string }[]
      ).map((row) => ({
        id: row.id,
        collection: row.collection,
        snapshot: JSON.parse(row.secret),
      })),
    }));
    const metadata = JSON.stringify({
      schemaVersion: "mqw-export-1",
      exportedAt: new Date().toISOString(),
      user,
      state,
      ownedSnapshots,
    });
    const iterator = exportJson(
      metadata.slice(0, -1) + ',"voiceFiles":[',
      user.id,
      state.voiceAssets,
    );
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          try {
            const next = await iterator.next();
            if (next.done) controller.close();
            else controller.enqueue(encoder.encode(next.value));
          } catch {
            controller.error(new Error("تعذّر إكمال تصدير البيانات."));
          }
        },
        async cancel() {
          await iterator.return(undefined);
        },
      },
      { highWaterMark: 0 },
    );
    return new Response(stream, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="mqw-export.json"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
