/** Private operator backup/restore. No network calls, credentials or content in stdout. */
import { backup, DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  rmdirSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

const FORMAT = "mqw-backup-v1";
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 20000;
const ID = /^[A-Za-z0-9_-]{1,100}$/;
export class BackupError extends Error {}
function stop(message) {
  throw new BackupError(message);
}
function inside(parent, child) {
  const path = relative(parent, child);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}
function existingDirectory(path) {
  const absolute = resolve(path);
  if (
    !existsSync(absolute) ||
    !lstatSync(absolute).isDirectory() ||
    lstatSync(absolute).isSymbolicLink()
  )
    stop("A source directory is missing or is a symbolic link.");
  return realpathSync(absolute);
}
function safeFile(root, name) {
  if (
    name !== "mqw.sqlite" &&
    !/^voice\/[A-Za-z0-9_-]{1,100}\/[A-Za-z0-9_-]{1,100}$/.test(name)
  )
    stop("The backup contains an unsafe file path.");
  const full = join(root, ...name.split("/"));
  for (let parent = dirname(full); parent !== root; parent = dirname(parent)) {
    const stat = lstatSync(parent);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      stop("The backup contains an unsafe directory.");
  }
  const stat = lstatSync(full);
  if (!stat.isFile() || stat.isSymbolicLink())
    stop("A required file is missing or is not a regular file.");
  return full;
}
function digestFile(source, destination, expected) {
  const input = openSync(
    source,
    constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
  );
  let output;
  try {
    const before = fstatSync(input);
    if (!before.isFile()) stop("A required file is not a regular file.");
    if (expected && before.size !== expected.bytes)
      stop("A file size does not match its snapshot.");
    if (destination) {
      mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
      output = openSync(destination, "wx", 0o600);
    }
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(65536);
    let bytes = 0;
    for (;;) {
      const length = readSync(input, buffer, 0, buffer.length, null);
      if (!length) break;
      hash.update(buffer.subarray(0, length));
      if (output !== undefined) {
        let offset = 0;
        while (offset < length)
          offset += writeSync(output, buffer, offset, length - offset);
      }
      bytes += length;
    }
    const after = fstatSync(input);
    if (
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ino !== after.ino ||
      bytes !== before.size
    )
      stop(
        "A source file changed during the backup; pause recording/deletion and retry.",
      );
    const sha256 = hash.digest("hex");
    if (
      expected &&
      (bytes !== expected.bytes ||
        (expected.sha256 && sha256 !== expected.sha256))
    )
      stop("A file checksum does not match the verified manifest.");
    if (output !== undefined) fsyncSync(output);
    return { bytes, sha256 };
  } finally {
    closeSync(input);
    if (output !== undefined) closeSync(output);
  }
}
function privateWrite(path, data) {
  const fd = openSync(path, "wx", 0o600);
  try {
    writeFileSync(fd, data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function syncDirectory(path) {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function inspectDatabase(path, writable = false) {
  const db = new DatabaseSync(path, { readOnly: !writable });
  try {
    db.exec("PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON;");
    const checks = db.prepare("PRAGMA integrity_check").all();
    if (checks.length !== 1 || Object.values(checks[0])[0] !== "ok")
      stop("The SQLite snapshot failed its integrity check.");
    if (db.prepare("PRAGMA foreign_key_check").all().length)
      stop("The SQLite snapshot contains invalid relationships.");
    for (const name of [
      "users",
      "sessions",
      "records",
      "idempotency",
      "setup_tokens",
      "file_cleanup",
    ]) {
      if (
        !db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          )
          .get(name)
      )
        stop("The SQLite snapshot is missing required MQW tables.");
    }
    const rows = db
      .prepare(
        "SELECT id,user_id,data FROM records WHERE collection='voiceAssets' ORDER BY user_id,id",
      )
      .all();
    const files = rows.map((row) => {
      if (!ID.test(row.id) || !ID.test(row.user_id))
        stop("A voice snapshot has an invalid identity.");
      let data;
      try {
        data = JSON.parse(row.data);
      } catch {
        stop("A voice snapshot has invalid metadata.");
      }
      if (
        !Number.isSafeInteger(data.size) ||
        data.size <= 0 ||
        data.size > 20 * 1024 * 1024
      )
        stop("A voice snapshot has an invalid size.");
      return { path: `voice/${row.user_id}/${row.id}`, bytes: data.size };
    });
    if (files.length + 1 > MAX_FILES) stop("The snapshot has too many files.");
    return { db, files };
  } catch (error) {
    db.close();
    throw error;
  }
}
function prepareDestination(destination, allowEmpty) {
  const target = resolve(destination);
  if (target === dirname(target))
    stop("The destination must be a dedicated private directory.");
  const publicDirectory = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "public",
  );
  if (inside(publicDirectory, target))
    stop("A public directory cannot hold private backups or restored data.");
  if (existsSync(target)) {
    const stat = lstatSync(target);
    if (
      !allowEmpty ||
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      readdirSync(target).length
    )
      stop("The destination already contains data; refusing to overwrite it.");
  }
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const parent = realpathSync(dirname(target));
  const canonical = join(parent, basename(target));
  const stage = join(parent, `.mqw-${randomUUID()}`);
  mkdirSync(stage, { mode: 0o700 });
  return { target: canonical, stage };
}
function publish(stage, target, allowEmpty) {
  if (existsSync(target)) {
    if (
      !allowEmpty ||
      !lstatSync(target).isDirectory() ||
      lstatSync(target).isSymbolicLink() ||
      readdirSync(target).length
    )
      stop("The destination changed; refusing to overwrite it.");
    rmdirSync(target);
  }
  syncDirectory(stage);
  renameSync(stage, target);
  chmodSync(target, 0o700);
  syncDirectory(dirname(target));
}
export async function createBackup(sourceDirectory, destinationDirectory) {
  const source = existingDirectory(sourceDirectory);
  const destination = resolve(destinationDirectory);
  if (inside(source, destination))
    stop("A backup must be outside the live data directory.");
  const { stage, target } = prepareDestination(destination, false);
  let sourceDb;
  let snapshot;
  try {
    if (inside(source, target))
      stop("A backup must be outside the live data directory.");
    const database = safeFile(source, "mqw.sqlite");
    sourceDb = new DatabaseSync(database, { readOnly: true });
    sourceDb.exec("PRAGMA busy_timeout=5000;");
    await backup(sourceDb, join(stage, "mqw.sqlite"));
    sourceDb.close();
    sourceDb = undefined;
    chmodSync(join(stage, "mqw.sqlite"), 0o600);
    snapshot = inspectDatabase(join(stage, "mqw.sqlite"), true);
    // Make the archived database self-contained; never archive a live main file without its WAL.
    snapshot.db.exec("PRAGMA journal_mode=DELETE;");
    const voiceFiles = snapshot.files;
    snapshot.db.close();
    snapshot = undefined;
    const files = [
      { path: "mqw.sqlite", ...digestFile(join(stage, "mqw.sqlite")) },
    ];
    for (const item of voiceFiles) {
      let path;
      try {
        path = safeFile(source, item.path);
      } catch {
        stop(
          "A voice file referenced by the snapshot is missing; pause deletion and retry.",
        );
      }
      files.push({
        path: item.path,
        ...digestFile(path, join(stage, ...item.path.split("/")), item),
      });
    }
    const manifest =
      JSON.stringify(
        { format: FORMAT, createdAt: new Date().toISOString(), files },
        null,
        2,
      ) + "\n";
    privateWrite(join(stage, "manifest.json"), manifest);
    privateWrite(
      join(stage, "manifest.sha256"),
      createHash("sha256").update(manifest).digest("hex") + "\n",
    );
    await verifyBackup(stage);
    publish(stage, target, false);
    return { files: files.length };
  } catch (error) {
    snapshot?.db.close();
    sourceDb?.close();
    rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}
function loadManifest(directory) {
  for (const name of ["manifest.json", "manifest.sha256"]) {
    const stat = lstatSync(join(directory, name));
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size > (name === "manifest.json" ? MAX_MANIFEST_BYTES : 100)
    )
      stop("The backup manifest is missing or invalid.");
  }
  const raw = readFileSync(join(directory, "manifest.json"));
  const expected = readFileSync(
    join(directory, "manifest.sha256"),
    "utf8",
  ).trim();
  if (
    !/^[a-f0-9]{64}$/.test(expected) ||
    createHash("sha256").update(raw).digest("hex") !== expected
  )
    stop("The backup manifest checksum does not match.");
  let manifest;
  try {
    manifest = JSON.parse(raw.toString("utf8"));
  } catch {
    stop("The backup manifest is not valid JSON.");
  }
  if (
    manifest.format !== FORMAT ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length ||
    manifest.files.length > MAX_FILES
  )
    stop("The backup format is unsupported.");
  const names = new Set();
  for (const file of manifest.files) {
    if (
      !file ||
      typeof file.path !== "string" ||
      names.has(file.path) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      file.bytes > 10 * 1024 ** 3 ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      stop("The backup file manifest is invalid.");
    safeFile(directory, file.path);
    names.add(file.path);
  }
  if (!names.has("mqw.sqlite")) stop("The backup has no database snapshot.");
  return manifest;
}
export async function verifyBackup(backupDirectory) {
  const directory = existingDirectory(backupDirectory);
  const manifest = loadManifest(directory);
  for (const file of manifest.files)
    digestFile(safeFile(directory, file.path), undefined, file);
  const snapshot = inspectDatabase(join(directory, "mqw.sqlite"));
  try {
    const declared = new Map(manifest.files.map((file) => [file.path, file]));
    if (manifest.files.length !== snapshot.files.length + 1)
      stop("The manifest does not match the database voice snapshot.");
    for (const voice of snapshot.files) {
      if (declared.get(voice.path)?.bytes !== voice.bytes)
        stop("The manifest does not match a voice record.");
    }
  } finally {
    snapshot.db.close();
  }
  return { files: manifest.files.length };
}
export async function restoreBackup(backupDirectory, destinationDirectory) {
  const source = existingDirectory(backupDirectory);
  const destination = resolve(destinationDirectory);
  if (inside(source, destination) || inside(destination, source))
    stop("Restore source and destination must be separate directories.");
  // Verify before allocating or changing the destination directory.
  await verifyBackup(source);
  const manifest = loadManifest(source);
  const { stage, target } = prepareDestination(destination, true);
  let restored;
  try {
    if (inside(source, target) || inside(target, source))
      stop("Restore source and destination must be separate directories.");
    for (const file of manifest.files)
      digestFile(
        safeFile(source, file.path),
        join(stage, ...file.path.split("/")),
        file,
      );
    restored = inspectDatabase(join(stage, "mqw.sqlite"), true);
    restored.db.exec(
      "BEGIN IMMEDIATE; DELETE FROM sessions; DELETE FROM file_cleanup; COMMIT; PRAGMA journal_mode=DELETE;",
    );
    restored.db.close();
    restored = undefined;
    chmodSync(join(stage, "mqw.sqlite"), 0o600);
    publish(stage, target, true);
    return { files: manifest.files.length, sessionsRevoked: true };
  } catch (error) {
    restored?.db.close();
    rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}
async function main() {
  process.umask(0o077);
  const args = process.argv.slice(2);
  let command = args[0]?.startsWith("-") ? "backup" : args.shift() || "backup";
  if (args.includes("--restore")) {
    command = "restore";
    args.splice(args.indexOf("--restore"), 1);
  }
  const options = {};
  while (args.length) {
    const key = args.shift();
    const value = args.shift();
    if (
      !["--source", "--destination"].includes(key) ||
      !value ||
      value.startsWith("--")
    )
      stop(
        "Usage: node scripts/backup.mjs backup|restore|verify --source PRIVATE_DIRECTORY [--destination NEW_PRIVATE_DIRECTORY]",
      );
    options[key.slice(2)] = value;
  }
  if (!options.source || (command !== "verify" && !options.destination))
    stop("Source and destination must be explicitly selected.");
  if (command === "backup")
    await createBackup(options.source, options.destination);
  else if (command === "restore")
    await restoreBackup(options.source, options.destination);
  else if (command === "verify") await verifyBackup(options.source);
  else stop("Unknown backup operation.");
  console.log(
    `MQW ${command} completed${command === "restore" ? "; previous sessions revoked" : ""}.`,
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error instanceof BackupError
        ? error.message
        : "MQW backup operation failed; check permissions, available space and source integrity.",
    );
    process.exitCode = 1;
  });
}
