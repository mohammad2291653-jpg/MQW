/**
 * MQW 90 private progress photos.
 *
 * Local (SQLite) mode: bytes live in DATA_DIR/media/<owner>/<id> with 0600
 * permissions and are only streamed through an authenticated, owner-checked
 * route with `no-store`. There is no public URL, CDN link or thumbnail service.
 *
 * Cloud (PostgreSQL) mode: bytes live in `mqw_private.media_blobs`, bound to
 * the owning record by a composite foreign key with owner RLS. The feature is
 * detected at runtime and stays disabled (HTTP 501) until the owner-approved
 * migration (supabase/proposals/mqw90_private_media.sql) has been applied.
 *
 * Metadata hygiene: the browser re-encodes images before upload, and the server
 * independently strips JPEG APP1–APP15/COM segments (EXIF, GPS, XMP, comments)
 * and PNG ancillary text/EXIF chunks before writing.
 */
import { constants } from "node:fs";
import { mkdir, open, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ApiError,
  createEntity,
  DATA_DIR,
  deleteEntity,
  listEntities,
  privatePhotosAvailable,
  query,
  requireEntity,
  storageBackend,
  transaction,
  updateEntity,
  withOwner,
} from "./db";
import { isDay } from "../evolution";
import type { Entity, EvoPhoto } from "../types";

export const PHOTO_FILE_LIMIT = 8 * 1024 * 1024;
const PHOTO_ACCOUNT_LIMIT = 300 * 1024 * 1024;
export const photosEnabled = privatePhotosAvailable;

export function mediaDir(userId: string) {
  if (!/^[\w-]+$/.test(userId)) throw new ApiError("الحساب غير صالح.");
  return join(DATA_DIR, "media", userId);
}
export function photoPath(userId: string, id: string) {
  if (!/^[\w-]+$/.test(id)) throw new ApiError("الصورة غير صالحة.");
  return join(mediaDir(userId), id);
}
async function requireEnabled() {
  if (!(await photosEnabled()))
    throw new ApiError(
      "حفظ الصور الخاصة غير مفعّل في الاستضافة السحابية بعد. يتطلب ذلك ترحيل قاعدة بيانات يوافق عليه صاحب المشروع.",
      501,
    );
}

/** Returns the detected type, or throws for anything that is not a real JPEG/PNG. */
export function sniffImage(bytes: Uint8Array): "image/jpeg" | "image/png" {
  if (
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length > 8 && png.every((b, i) => bytes[i] === b))
    return "image/png";
  throw new ApiError("صيغة الصورة غير مدعومة. استخدم JPEG أو PNG.");
}

/** Remove EXIF/XMP/ICC-comment style metadata from a JPEG without re-encoding pixels. */
export function stripJpeg(input: Buffer): Buffer {
  const out: Buffer[] = [input.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= input.length) {
    if (input[i] !== 0xff) throw new ApiError("ملف JPEG تالف.");
    const marker = input[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xda) {
      // Start of scan: the remainder is image data.
      out.push(input.subarray(i));
      return Buffer.concat(out);
    }
    if (marker === 0xd9) break;
    if (marker >= 0xd0 && marker <= 0xd7) {
      out.push(input.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const length = input.readUInt16BE(i + 2);
    if (length < 2 || i + 2 + length > input.length)
      throw new ApiError("ملف JPEG تالف.");
    // Keep APP0 (JFIF) and APP14 (Adobe colour transform); drop APP1–APP13, APP15 and COM.
    const drop =
      (marker >= 0xe1 && marker <= 0xef && marker !== 0xee) || marker === 0xfe;
    if (!drop) out.push(input.subarray(i, i + 2 + length));
    i += 2 + length;
  }
  out.push(Buffer.from([0xff, 0xd9]));
  return Buffer.concat(out);
}
/** Remove PNG text, time and EXIF chunks. */
export function stripPng(input: Buffer): Buffer {
  const out: Buffer[] = [input.subarray(0, 8)];
  let i = 8;
  const drop = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);
  while (i + 12 <= input.length) {
    const length = input.readUInt32BE(i);
    const type = input.toString("latin1", i + 4, i + 8);
    const end = i + 12 + length;
    if (end > input.length) throw new ApiError("ملف PNG تالف.");
    if (!drop.has(type)) out.push(input.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
}

async function checkQuota(userId: string, size: number) {
  const photos = await listEntities<EvoPhoto>(userId, "evoPhotos");
  const used = photos.reduce(
    (sum, p) =>
      sum +
      (Number.isSafeInteger(p.size) && p.size > 0 ? p.size : PHOTO_FILE_LIMIT),
    0,
  );
  if (used + size > PHOTO_ACCOUNT_LIMIT)
    throw new ApiError(
      "وصلت مساحة الصور الخاصة إلى 300 ميغابايت؛ احذف بعض الصور أولًا.",
    );
}

export async function savePhoto(
  userId: string,
  raw: Buffer,
  meta: {
    pillar: unknown;
    area: unknown;
    date: unknown;
    caption: unknown;
    width?: unknown;
    height?: unknown;
  },
): Promise<EvoPhoto> {
  await requireEnabled();
  if (!raw.length || raw.length > PHOTO_FILE_LIMIT)
    throw new ApiError("حجم الصورة يجب ألا يتجاوز 8 ميغابايت.");
  const mimeType = sniffImage(raw);
  const bytes = mimeType === "image/jpeg" ? stripJpeg(raw) : stripPng(raw);
  const pillar = String(meta.pillar);
  const areas: Record<string, string[]> = {
    skin: ["face"],
    hair: ["scalp", "beard"],
    fitness: ["body"],
  };
  if (!areas[pillar]) throw new ApiError("القسم غير صالح.");
  const area = String(meta.area || areas[pillar][0]);
  if (!areas[pillar].includes(area)) throw new ApiError("المنطقة غير صالحة.");
  if (!isDay(meta.date)) throw new ApiError("تاريخ الصورة غير صالح.");
  const caption =
    typeof meta.caption === "string" ? meta.caption.slice(0, 300) : "";
  const dim = (v: unknown) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 && n <= 20000 ? n : undefined;
  };
  return withOwner(userId, () =>
    transaction(async () => {
      if (storageBackend === "postgres") {
        // Serialize this owner's uploads so concurrent requests cannot exceed the quota.
        const owner = await query(
          "SELECT id FROM mqw_private.users WHERE id=$1 FOR UPDATE",
          [userId],
        );
        if (!owner.rowCount)
          throw new ApiError("يرجى تسجيل الدخول للمتابعة.", 401);
      }
      await checkQuota(userId, bytes.length);
      const photo = await createEntity<EvoPhoto>(userId, "evoPhotos", {
        pillar,
        area,
        date: meta.date,
        caption,
        mimeType,
        size: bytes.length,
        width: dim(meta.width),
        height: dim(meta.height),
      });
      if (storageBackend === "postgres") {
        await query(
          "INSERT INTO mqw_private.media_blobs(user_id,asset_id,bytes) VALUES($1,$2,$3)",
          [userId, photo.id, bytes],
        );
        return photo;
      }
      await mkdir(mediaDir(userId), { recursive: true, mode: 0o700 });
      try {
        await writeFile(photoPath(userId, photo.id), bytes, {
          mode: 0o600,
          flag: "wx",
        });
      } catch (error) {
        await rm(photoPath(userId, photo.id), { force: true }).catch(() => {});
        throw error;
      }
      return photo;
    }),
  );
}

export async function readPhoto(userId: string, id: string) {
  await requireEnabled();
  return withOwner(userId, async () => {
    const photo = await requireEntity<EvoPhoto>(userId, "evoPhotos", id);
    if (
      !Number.isSafeInteger(photo.size) ||
      photo.size < 1 ||
      photo.size > PHOTO_FILE_LIMIT
    )
      throw new ApiError("بيانات الصورة غير صالحة.", 404);
    if (storageBackend === "postgres") {
      const result = await query(
        "SELECT bytes FROM mqw_private.media_blobs WHERE user_id=$1 AND asset_id=$2",
        [userId, id],
      );
      const bytes = result.rows[0]?.bytes;
      if (!Buffer.isBuffer(bytes) || bytes.length !== photo.size)
        throw new ApiError("ملف الصورة غير متاح. يمكنك حذف السجل.", 404);
      return { photo, bytes };
    }
    let handle;
    try {
      handle = await open(
        photoPath(userId, id),
        constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
      );
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size !== photo.size) throw new Error("size");
      const bytes = Buffer.allocUnsafe(photo.size);
      const { bytesRead } = await handle.read(bytes, 0, photo.size, 0);
      if (bytesRead !== photo.size) throw new Error("short read");
      return { photo, bytes };
    } catch {
      throw new ApiError("ملف الصورة غير متاح. يمكنك حذف السجل.", 404);
    } finally {
      await handle?.close().catch(() => {});
    }
  });
}

export async function updatePhotoCaption(
  userId: string,
  id: string,
  caption: unknown,
  date?: unknown,
) {
  return withOwner(userId, () =>
    transaction(async () => {
      await requireEntity(userId, "evoPhotos", id);
      const patch: Record<string, unknown> = {};
      if (caption !== undefined) {
        if (typeof caption !== "string" || caption.length > 300)
          throw new ApiError("التعليق أطول من المسموح.");
        patch.caption = caption;
      }
      if (date !== undefined) {
        if (!isDay(date)) throw new ApiError("التاريخ غير صالح.");
        patch.date = date;
      }
      return updateEntity(userId, "evoPhotos", id, patch);
    }),
  );
}

export async function removePhoto(userId: string, id: string) {
  return withOwner(userId, () =>
    transaction(async () => {
      await requireEntity(userId, "evoPhotos", id);
      if (storageBackend === "sqlite")
        await rm(photoPath(userId, id), { force: true });
      // PostgreSQL: the owner-bound foreign key deletes the blob in the same transaction.
      await deleteEntity(userId, "evoPhotos", id);
      return { deleted: true };
    }),
  );
}

/** Delete every record of a pillar (and its private photo files) for this owner. */
export async function deletePillarData(
  userId: string,
  plan: { collection: string; match?: (e: Entity) => boolean }[],
) {
  return withOwner(userId, () =>
    transaction(async () => {
      let count = 0;
      for (const { collection, match } of plan) {
        for (const record of await listEntities<Entity>(userId, collection)) {
          if (match && !match(record)) continue;
          if (collection === "evoPhotos" && storageBackend === "sqlite")
            await rm(photoPath(userId, record.id), { force: true });
          await deleteEntity(userId, collection, record.id);
          count++;
        }
      }
      return { deleted: count };
    }),
  );
}
