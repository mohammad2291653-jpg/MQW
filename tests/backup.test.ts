import { test, after } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  statSync,
  readdirSync,
  copyFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
const { createBackup, verifyBackup, restoreBackup } =
  require("../scripts/backup.mjs") as typeof import("../scripts/backup.mjs");
const root = mkdtempSync(join(tmpdir(), "mqw-backup-test-"));
after(() => rmSync(root, { recursive: true, force: true }));
function fixture(name: string) {
  const source = join(root, name);
  mkdirSync(source, { mode: 0o700 });
  const db = new DatabaseSync(join(source, "mqw.sqlite"));
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;
    CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,password_hash TEXT);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id));
    CREATE TABLE records(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),collection TEXT,data TEXT);
    CREATE TABLE setup_tokens(token_hash TEXT PRIMARY KEY,consumed_at TEXT);
    CREATE TABLE idempotency(user_id TEXT REFERENCES users(id),key TEXT);
    CREATE TABLE file_cleanup(path TEXT PRIMARY KEY,created_at TEXT);`);
  db.prepare("INSERT INTO users VALUES(?,?,?)").run(
    "owner-id",
    "synthetic@example.test",
    "synthetic-password-hash",
  );
  db.prepare("INSERT INTO sessions VALUES(?,?)").run(
    "old-session-hash",
    "owner-id",
  );
  db.prepare("INSERT INTO setup_tokens VALUES(?,?)").run(
    "consumed-setup-hash",
    new Date().toISOString(),
  );
  db.prepare("INSERT INTO file_cleanup VALUES(?,?)").run(
    "/old/private/path/pending.deleting",
    new Date().toISOString(),
  );
  const audio = Buffer.from("synthetic-private-audio-content");
  const voiceDirectory = join(source, "voice", "owner-id");
  mkdirSync(voiceDirectory, { recursive: true, mode: 0o700 });
  writeFileSync(join(voiceDirectory, "voice-id"), audio, { mode: 0o600 });
  db.prepare("INSERT INTO records VALUES(?,?,?,?)").run(
    "voice-id",
    "owner-id",
    "voiceAssets",
    JSON.stringify({ id: "voice-id", size: audio.length }),
  );
  db.prepare("INSERT INTO records VALUES(?,?,?,?)").run(
    "note-id",
    "owner-id",
    "notes",
    JSON.stringify({ text: "a private synthetic WAL note" }),
  );
  assert.ok(existsSync(join(source, "mqw.sqlite-wal")));
  assert.ok(statSync(join(source, "mqw.sqlite-wal")).size > 0);
  return { source, db, audio };
}
function rewriteManifest(
  directory: string,
  transform: (manifest: any) => void,
) {
  const manifest = JSON.parse(
    readFileSync(join(directory, "manifest.json"), "utf8"),
  );
  transform(manifest);
  const text = JSON.stringify(manifest);
  writeFileSync(join(directory, "manifest.json"), text);
  writeFileSync(
    join(directory, "manifest.sha256"),
    createHash("sha256").update(text).digest("hex") + "\n",
  );
}
test("online backup captures committed active-WAL data and restores private records, voice and consumed setup tokens", async () => {
  const { source, db, audio } = fixture("active-source");
  const backup = join(root, "active-backup");
  const restored = join(root, "active-restored");
  try {
    const result = await createBackup(source, backup);
    assert.equal(result.files, 2);
    assert.equal(statSync(backup).mode & 0o777, 0o700);
    for (const path of [
      "mqw.sqlite",
      "manifest.json",
      "manifest.sha256",
      "voice/owner-id/voice-id",
    ])
      assert.equal(statSync(join(backup, path)).mode & 0o777, 0o600);
    assert.equal((await verifyBackup(backup)).files, 2);
    assert.equal((await restoreBackup(backup, restored)).sessionsRevoked, true);
    const copy = new DatabaseSync(join(restored, "mqw.sqlite"), {
      readOnly: true,
    });
    try {
      assert.equal(
        (
          copy
            .prepare("SELECT email FROM users WHERE id=?")
            .get("owner-id") as { email: string }
        ).email,
        "synthetic@example.test",
      );
      assert.equal(
        JSON.parse(
          (
            copy
              .prepare("SELECT data FROM records WHERE id=?")
              .get("note-id") as { data: string }
          ).data,
        ).text,
        "a private synthetic WAL note",
      );
      assert.equal(
        (
          copy.prepare("SELECT COUNT(*) AS n FROM setup_tokens").get() as {
            n: number;
          }
        ).n,
        1,
      );
      assert.equal(
        (
          copy.prepare("SELECT COUNT(*) AS n FROM sessions").get() as {
            n: number;
          }
        ).n,
        0,
      );
      assert.equal(
        (
          copy.prepare("SELECT COUNT(*) AS n FROM file_cleanup").get() as {
            n: number;
          }
        ).n,
        0,
      );
      assert.deepEqual(
        readFileSync(join(restored, "voice", "owner-id", "voice-id")),
        audio,
      );
    } finally {
      copy.close();
    }
    await assert.rejects(
      () => restoreBackup(backup, restored),
      /refusing to overwrite/,
    );
    await assert.rejects(
      () => createBackup(source, backup),
      /refusing to overwrite/,
    );
  } finally {
    db.close();
  }
});
test("missing source audio aborts backup and removes incomplete output", async () => {
  const { source, db } = fixture("missing-source");
  const backup = join(root, "missing-backup");
  try {
    rmSync(join(source, "voice", "owner-id", "voice-id"));
    await assert.rejects(() => createBackup(source, backup), /missing/);
    assert.equal(existsSync(backup), false);
    assert.equal(
      readdirSync(root).some((path) => path.startsWith(".mqw-")),
      false,
    );
  } finally {
    db.close();
  }
});
test("restore rejects changed archive bytes and manifest checksums before creating destination", async () => {
  const { source, db } = fixture("tamper-source");
  const backup = join(root, "tamper-backup");
  const restored = join(root, "tamper-restored");
  try {
    await createBackup(source, backup);
    const path = join(backup, "voice", "owner-id", "voice-id");
    const original = readFileSync(path);
    const modified = Buffer.from(original);
    modified[0] ^= 1;
    writeFileSync(path, modified);
    await assert.rejects(() => restoreBackup(backup, restored), /checksum/);
    assert.equal(existsSync(restored), false);
    writeFileSync(path, original);
    writeFileSync(join(backup, "manifest.sha256"), "0".repeat(64));
    await assert.rejects(() => verifyBackup(backup), /manifest checksum/);
  } finally {
    db.close();
  }
});
test("restore rejects traversal/symlink files, and an existing destination remains unchanged", async () => {
  const { source, db } = fixture("path-source");
  const backup = join(root, "path-backup");
  const restored = join(root, "path-restored");
  try {
    await createBackup(source, backup);
    mkdirSync(restored);
    writeFileSync(join(restored, "existing"), "keep");
    await assert.rejects(
      () => restoreBackup(backup, restored),
      /refusing to overwrite/,
    );
    assert.equal(readFileSync(join(restored, "existing"), "utf8"), "keep");
    const voice = join(backup, "voice", "owner-id", "voice-id");
    const outside = join(root, "outside-audio");
    copyFileSync(voice, outside);
    rmSync(voice);
    symlinkSync(outside, voice);
    await assert.rejects(() => verifyBackup(backup), /not a regular file/);
    rmSync(voice);
    copyFileSync(outside, voice);
    rewriteManifest(backup, (manifest) => {
      manifest.files[1].path = "../outside-audio";
    });
    await assert.rejects(() => verifyBackup(backup), /unsafe file path/);
  } finally {
    db.close();
  }
});
