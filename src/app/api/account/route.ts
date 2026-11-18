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
    const folder = voiceDir(user.id);
    const tombstone = `${folder}.deleting`;
    let moved = false;
    try {
      await withOwner(user.id, async () => {
        await verifyPassword(user.id, body.password);
        await transaction(async () => {
          if (existsSync(folder)) {
            renameSync(folder, tombstone);
            moved = true;
            await db
              .prepare(
                "INSERT OR REPLACE INTO file_cleanup(path,created_at) VALUES(?,?)",
              )
              .run(tombstone, new Date().toISOString());
          }
          await db.prepare("DELETE FROM users WHERE id=?").run(user.id);
        });
      });
    } catch (error) {
      if (moved && existsSync(tombstone)) renameSync(tombstone, folder);
      throw error;
    }
    // withOwner commits its actual transaction before destructive filesystem cleanup.
    await drainFileCleanup();
    const filesDeletionPending = !!(await db
      .prepare("SELECT path FROM file_cleanup WHERE path=?")
      .get(tombstone));
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
