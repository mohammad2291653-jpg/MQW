import { constants } from "node:fs";
import { open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import type { ReadStream } from "node:fs";
import { requireUser, verifyPassword } from "@/lib/server/auth";
import {
  getState,
  db,
  query,
  storageBackend,
  transaction,
  withOwner,
} from "@/lib/server/db";
import { fail, rateLimit, checkOrigin, readBody } from "@/lib/server/http";
import { voicePath } from "@/lib/server/voice";
import type { VoiceAsset } from "@/lib/types";
export const runtime = "nodejs";

/** The generator is pulled by the consumer; it never buffers the audio archive. */
async function* localVoiceJson(
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
/** Each cloud pull reads at most 768 KiB; no complete file/archive is accumulated. */
async function* postgresVoiceJson(
  userId: string,
  asset: VoiceAsset,
): AsyncGenerator<string> {
  if (
    !Number.isSafeInteger(asset.size) ||
    asset.size < 1 ||
    asset.size > 20 * 1024 * 1024
  ) {
    yield JSON.stringify({
      id: asset.id,
      error: "بيانات حجم التسجيل غير صالحة",
    });
    return;
  }
  try {
    const result = await withOwner(userId, () =>
      query(
        "SELECT octet_length(bytes) AS size FROM mqw_private.voice_blobs WHERE user_id=$1 AND asset_id=$2",
        [userId, asset.id],
      ),
    );
    if (Number(result.rows[0]?.size) !== asset.size)
      throw new Error("unavailable audio");
  } catch {
    yield JSON.stringify({
      id: asset.id,
      error: "ملف التسجيل غير متاح أو تغيّر منذ حفظ بياناته",
    });
    return;
  }
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
    const chunkSize = 768 * 1024;
    while (total < asset.size) {
      const wanted = Math.min(chunkSize, asset.size - total);
      const result = await withOwner(userId, () =>
        query(
          "SELECT substring(bytes FROM $3 FOR $4) AS chunk, octet_length(bytes) AS size FROM mqw_private.voice_blobs WHERE user_id=$1 AND asset_id=$2",
          [userId, asset.id, total + 1, wanted],
        ),
      );
      const row = result.rows[0];
      const chunk = row?.chunk;
      if (
        !Buffer.isBuffer(chunk) ||
        chunk.length !== wanted ||
        Number(row.size) !== asset.size
      )
        throw new Error("audio changed while exporting");
      total += chunk.length;
      const bytes = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      const boundary = bytes.length - (bytes.length % 3);
      if (boundary) yield bytes.subarray(0, boundary).toString("base64");
      carry = Buffer.from(bytes.subarray(boundary));
    }
    complete = total === asset.size;
  } catch {
    // A deleted/unavailable chunk is a labelled partial export, never a claimed complete file.
  }
  if (carry.length) yield carry.toString("base64");
  yield complete
    ? '"}'
    : '","complete":false,"error":"تعذّر إكمال قراءة التسجيل؛ أعد التصدير"}';
}
async function* voiceJson(
  userId: string,
  asset: VoiceAsset,
): AsyncGenerator<string> {
  if (storageBackend === "postgres") yield* postgresVoiceJson(userId, asset);
  else yield* localVoiceJson(userId, asset);
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
    const user = await requireUser(request);
    const body = await readBody(request);
    await withOwner(user.id, () => verifyPassword(user.id, body.password));
    rateLimit(`export:${user.id}`, 3);
    const { state, ownedSnapshots } = await withOwner(user.id, () =>
      transaction(async () => {
        const state = await getState(user.id);
        const rows = (await db
          .prepare(
            "SELECT id,collection,secret FROM records WHERE user_id=? AND secret!='{}'",
          )
          .all(user.id)) as {
          id: string;
          collection: string;
          secret: string | Record<string, unknown>;
        }[];
        const ownedSnapshots = rows.map((row) => ({
          id: row.id,
          collection: row.collection,
          snapshot:
            typeof row.secret === "string"
              ? JSON.parse(row.secret)
              : row.secret,
        }));
        return { state, ownedSnapshots };
      }),
    );
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
