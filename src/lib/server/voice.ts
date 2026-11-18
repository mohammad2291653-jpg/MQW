import { constants } from "node:fs";
import { mkdir, open, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ApiError,
  createEntity,
  DATA_DIR,
  deleteEntity,
  listEntities,
  query,
  requireEntity,
  storageBackend,
  transaction,
  withOwner,
} from "./db";
import type { VoiceAsset } from "../types";

export const VOICE_FILE_LIMIT = 20 * 1024 * 1024;
const VOICE_ACCOUNT_LIMIT = 200 * 1024 * 1024;
export function voiceDir(userId: string) {
  if (!/^[\w-]+$/.test(userId)) throw new ApiError("الحساب غير صالح.");
  return join(DATA_DIR, "voice", userId);
}
export function voicePath(userId: string, id: string) {
  if (!/^[\w-]+$/.test(id)) throw new ApiError("التسجيل غير صالح.");
  return join(voiceDir(userId), id);
}
async function checkVoiceQuota(userId: string, size: number) {
  const assets = await listEntities<VoiceAsset>(userId, "voiceAssets");
  const used = assets.reduce(
    (sum, asset) =>
      sum +
      (Number.isSafeInteger(asset.size) && asset.size > 0
        ? asset.size
        : VOICE_FILE_LIMIT),
    0,
  );
  if (used + size > VOICE_ACCOUNT_LIMIT)
    throw new ApiError(
      "وصلت مساحة التسجيلات إلى 200 ميغابايت؛ احذف بعض التسجيلات أولًا.",
    );
}
export async function saveVoice(
  userId: string,
  file: File,
  title: string,
  duration?: number,
) {
  if (!file.size || file.size > VOICE_FILE_LIMIT)
    throw new ApiError("حجم التسجيل يجب ألا يتجاوز 20 ميغابايت.");
  const mimeType = file.type || "audio/webm";
  if (
    !/^audio\/(webm|mp4|mpeg|ogg|wav|x-wav)(;.*)?$/i.test(mimeType) &&
    mimeType !== "video/mp4"
  )
    throw new ApiError("صيغة الصوت غير مدعومة.");
  await withOwner(userId, () => checkVoiceQuota(userId, file.size));
  return {
    mimeType,
    title: title.slice(0, 200) || "تسجيل صوتي",
    duration:
      typeof duration === "number" && Number.isFinite(duration) && duration >= 0
        ? duration
        : undefined,
    size: file.size,
  };
}

/** Metadata and cloud bytes commit together; quota checks serialize per owner. */
export async function writeVoice(
  userId: string,
  values: Record<string, unknown>,
  buffer: Buffer,
): Promise<VoiceAsset> {
  if (
    !buffer.length ||
    buffer.length > VOICE_FILE_LIMIT ||
    values.size !== buffer.length
  )
    throw new ApiError("حجم ملف الصوت لا يطابق بيانات التسجيل.");
  return withOwner(userId, () =>
    transaction(async () => {
      if (storageBackend === "postgres") {
        const owner = await query(
          "SELECT id FROM mqw_private.users WHERE id=$1 FOR UPDATE",
          [userId],
        );
        if (!owner.rowCount)
          throw new ApiError("يرجى تسجيل الدخول للمتابعة.", 401);
      }
      // Recheck inside the write transaction; simultaneous uploads cannot exceed the quota.
      await checkVoiceQuota(userId, buffer.length);
      const asset = await createEntity<VoiceAsset>(
        userId,
        "voiceAssets",
        values,
      );
      if (storageBackend === "postgres") {
        await query(
          "INSERT INTO mqw_private.voice_blobs(user_id,asset_id,bytes) VALUES($1,$2,$3)",
          [userId, asset.id, buffer],
        );
      } else {
        await mkdir(voiceDir(userId), { recursive: true, mode: 0o700 });
        try {
          await writeFile(voicePath(userId, asset.id), buffer, { mode: 0o600 });
        } catch (error) {
          await rm(voicePath(userId, asset.id), { force: true }).catch(
            () => {},
          );
          throw error;
        }
      }
      return asset;
    }),
  );
}

export async function readVoice(userId: string, id: string) {
  return withOwner(userId, async () => {
    const asset = await requireEntity<VoiceAsset>(userId, "voiceAssets", id);
    if (
      !Number.isSafeInteger(asset.size) ||
      asset.size < 1 ||
      asset.size > VOICE_FILE_LIMIT
    )
      throw new ApiError("بيانات التسجيل غير صالحة. يمكنك حذف التسجيل.", 404);
    if (storageBackend === "postgres") {
      const result = await query(
        "SELECT bytes FROM mqw_private.voice_blobs WHERE user_id=$1 AND asset_id=$2",
        [userId, id],
      );
      const bytes = result.rows[0]?.bytes;
      if (!Buffer.isBuffer(bytes) || bytes.length !== asset.size)
        throw new ApiError(
          "ملف التسجيل غير متاح. يمكنك حذف السجل وإعادة التسجيل.",
          404,
        );
      return { asset, bytes };
    }
    let handle;
    try {
      handle = await open(
        voicePath(userId, id),
        constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
      );
      const before = await handle.stat();
      if (!before.isFile() || before.size !== asset.size)
        throw new Error("invalid file size");
      // A host-side file change must never make playback allocate beyond the saved 20 MiB limit.
      const bytes = Buffer.allocUnsafe(asset.size);
      let total = 0;
      while (total < bytes.length) {
        const part = await handle.read(
          bytes,
          total,
          bytes.length - total,
          total,
        );
        if (!part.bytesRead) break;
        total += part.bytesRead;
      }
      const after = await handle.stat();
      if (
        total !== asset.size ||
        after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs
      )
        throw new Error("file changed");
      return { asset, bytes };
    } catch {
      throw new ApiError(
        "ملف التسجيل غير متاح. يمكنك حذف السجل وإعادة التسجيل.",
        404,
      );
    } finally {
      await handle?.close().catch(() => {});
    }
  });
}

export async function removeVoice(userId: string, id: string) {
  return withOwner(userId, () =>
    transaction(async () => {
      await requireEntity(userId, "voiceAssets", id);
      if (storageBackend === "sqlite")
        await rm(voicePath(userId, id), { force: true });
      // PostgreSQL's owner-bound foreign key deletes the blob in the same transaction.
      await deleteEntity(userId, "voiceAssets", id);
      return { deleted: true };
    }),
  );
}
