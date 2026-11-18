import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  ApiError,
  createEntity,
  DATA_DIR,
  deleteEntity,
  listEntities,
  requireEntity,
} from "./db";
import type { VoiceAsset } from "../types";
export function voiceDir(userId: string) {
  if (!/^[\w-]+$/.test(userId)) throw new ApiError("الحساب غير صالح.");
  return join(DATA_DIR, "voice", userId);
}
export function voicePath(userId: string, id: string) {
  if (!/^[\w-]+$/.test(id)) throw new ApiError("التسجيل غير صالح.");
  return join(voiceDir(userId), id);
}
export function saveVoice(
  userId: string,
  file: File,
  title: string,
  duration?: number,
) {
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new ApiError("حجم التسجيل يجب ألا يتجاوز 20 ميغابايت.");
  const mimeType = file.type || "audio/webm";
  if (
    !/^audio\/(webm|mp4|mpeg|ogg|wav|x-wav)(;.*)?$/i.test(mimeType) &&
    mimeType !== "video/mp4"
  )
    throw new ApiError("صيغة الصوت غير مدعومة.");
  if (
    listEntities<VoiceAsset>(userId, "voiceAssets").reduce(
      (sum, x) => sum + x.size,
      0,
    ) +
      file.size >
    200 * 1024 * 1024
  )
    throw new ApiError(
      "وصلت مساحة التسجيلات إلى 200 ميغابايت؛ احذف بعض التسجيلات أولًا.",
    );
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
export function writeVoice(
  userId: string,
  values: Record<string, unknown>,
  buffer: Buffer,
) {
  const asset = createEntity<VoiceAsset>(userId, "voiceAssets", values);
  mkdirSync(voiceDir(userId), { recursive: true, mode: 0o700 });
  try {
    writeFileSync(voicePath(userId, asset.id), buffer, { mode: 0o600 });
  } catch (error) {
    rmSync(voicePath(userId, asset.id), { force: true });
    throw error;
  }
  return asset;
}
export function readVoice(userId: string, id: string) {
  const asset = requireEntity<VoiceAsset>(userId, "voiceAssets", id);
  try {
    return { asset, bytes: readFileSync(voicePath(userId, id)) };
  } catch {
    throw new ApiError(
      "ملف التسجيل غير متاح. يمكنك حذف السجل وإعادة التسجيل.",
      404,
    );
  }
}
export function removeVoice(userId: string, id: string) {
  requireEntity(userId, "voiceAssets", id);
  rmSync(voicePath(userId, id), { force: true });
  deleteEntity(userId, "voiceAssets", id);
  return { deleted: true };
}
