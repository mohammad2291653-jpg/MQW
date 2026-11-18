import { existsSync, renameSync, rmSync } from "node:fs";
import {
  requireUser,
  verifyPassword,
  changePassword,
  sessionCookie,
} from "@/lib/server/auth";
import { db, transaction, drainFileCleanup } from "@/lib/server/db";
import { checkOrigin, fail, json, readBody } from "@/lib/server/http";
import { voiceDir } from "@/lib/server/voice";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = requireUser(request);
    const body = await readBody(request);
    const token = changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
    return json({ changed: true }, 200, { "Set-Cookie": sessionCookie(token) });
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const user = requireUser(request);
    const body = await readBody(request);
    verifyPassword(user.id, body.password);
    const folder = voiceDir(user.id);
    const tombstone = `${folder}.deleting`;
    let moved = false;
    try {
      transaction(() => {
        if (existsSync(folder)) {
          renameSync(folder, tombstone);
          moved = true;
          db.prepare(
            "INSERT OR REPLACE INTO file_cleanup(path,created_at) VALUES(?,?)",
          ).run(tombstone, new Date().toISOString());
        }
        db.prepare("DELETE FROM users WHERE id=?").run(user.id);
      });
    } catch (error) {
      if (moved && existsSync(tombstone)) renameSync(tombstone, folder);
      throw error;
    }
    drainFileCleanup();
    const filesDeletionPending = !!db
      .prepare("SELECT path FROM file_cleanup WHERE path=?")
      .get(tombstone);
    return json(
      { deleted: true, filesDeletionPending },
      filesDeletionPending ? 202 : 200,
      { "Set-Cookie": sessionCookie("", 0) },
    );
  } catch (error) {
    return fail(error);
  }
}
