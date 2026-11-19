import { existsSync, renameSync } from "node:fs";
import {
  requireUser,
  verifyPassword,
  changePassword,
  sessionCookie,
} from "@/lib/server/auth";
import {
  db,
  transaction,
  drainFileCleanup,
  storageBackend,
  withOwner,
} from "@/lib/server/db";
import { checkOrigin, fail, json, readBody } from "@/lib/server/http";
import { voiceDir } from "@/lib/server/voice";
import { mediaDir } from "@/lib/server/media";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(request);
    const body = await readBody(request);
    const token = await withOwner(user.id, () =>
      changePassword(user.id, body.currentPassword, body.newPassword),
    );
    return json({ changed: true }, 200, { "Set-Cookie": sessionCookie(token) });
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(request);
    const body = await readBody(request);
    if (storageBackend === "postgres") {
      await withOwner(user.id, async () => {
        await verifyPassword(user.id, body.password);
        await transaction(async () => {
          // Sessions, evidence, idempotency records and private voice bytes cascade together.
          await db.prepare("DELETE FROM users WHERE id=?").run(user.id);
        });
      });
      return json({ deleted: true, filesDeletionPending: false }, 200, {
        "Set-Cookie": sessionCookie("", 0),
      });
    }
    // Voice recordings and MQW 90 private photos are both tombstoned in the same transaction.
    const folders = [voiceDir(user.id), mediaDir(user.id)].map((folder) => ({
      folder,
      tombstone: `${folder}.deleting`,
      moved: false,
    }));
    try {
      await withOwner(user.id, async () => {
        await verifyPassword(user.id, body.password);
        await transaction(async () => {
          for (const entry of folders) {
            if (!existsSync(/*turbopackIgnore: true*/ entry.folder)) continue;
            renameSync(
              /*turbopackIgnore: true*/ entry.folder,
              /*turbopackIgnore: true*/ entry.tombstone,
            );
            entry.moved = true;
            await db
              .prepare(
                "INSERT OR REPLACE INTO file_cleanup(path,created_at) VALUES(?,?)",
              )
              .run(entry.tombstone, new Date().toISOString());
          }
          await db.prepare("DELETE FROM users WHERE id=?").run(user.id);
        });
      });
    } catch (error) {
      for (const entry of folders)
        if (
          entry.moved &&
          existsSync(/*turbopackIgnore: true*/ entry.tombstone)
        )
          renameSync(
            /*turbopackIgnore: true*/ entry.tombstone,
            /*turbopackIgnore: true*/ entry.folder,
          );
      throw error;
    }
    // withOwner commits its actual transaction before destructive filesystem cleanup.
    await drainFileCleanup();
    let filesDeletionPending = false;
    for (const entry of folders)
      if (
        await db
          .prepare("SELECT path FROM file_cleanup WHERE path=?")
          .get(entry.tombstone)
      )
        filesDeletionPending = true;
    return json(
      { deleted: true, filesDeletionPending },
      filesDeletionPending ? 202 : 200,
      {
        "Set-Cookie": sessionCookie("", 0),
      },
    );
  } catch (error) {
    return fail(error);
  }
}
