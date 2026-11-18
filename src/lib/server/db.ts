import { DatabaseSync } from "node:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AppState, Entity, Preferences } from "../types";

export const DATA_DIR = process.env.MQW_DATA_DIR || join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
export const db = new DatabaseSync(join(DATA_DIR, "mqw.sqlite"));
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,preferences TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,collection TEXT NOT NULL,data TEXT NOT NULL,secret TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS records_owner ON records(user_id,collection);
CREATE TABLE IF NOT EXISTS setup_tokens (token_hash TEXT PRIMARY KEY,consumed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS file_cleanup (path TEXT PRIMARY KEY,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS idempotency (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,key TEXT NOT NULL,action TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(user_id,key));`);
export const DEFAULT_PREFERENCES: Preferences = {
  timezone: "Asia/Hebron",
  studyMinutes: 60,
  personalization: true,
  reducedMotion: false,
  habitReminder: false,
  deadlineNotifications: false,
  onboardingDone: false,
  journalEnabled: false,
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function listEntities<T = Entity>(
  userId: string,
  collection: string,
): T[] {
  return (
    db
      .prepare(
        "SELECT data FROM records WHERE user_id=? AND collection=? ORDER BY created_at DESC,id",
      )
      .all(userId, collection) as { data: string }[]
  ).map((r) => JSON.parse(r.data));
}
export function getEntity<T = Entity>(
  userId: string,
  collection: string,
  id: string,
): T | undefined {
  const row = db
    .prepare(
      "SELECT data FROM records WHERE user_id=? AND collection=? AND id=?",
    )
    .get(userId, collection, id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}
export function requireEntity<T = Entity>(
  userId: string,
  collection: string,
  id: string,
): T {
  const value = getEntity<T>(userId, collection, id);
  if (!value)
    throw new ApiError("العنصر غير موجود أو غير متاح لهذا الحساب.", 404);
  return value;
}
export function createEntity<T = Entity>(
  userId: string,
  collection: string,
  values: Record<string, unknown>,
  secret: Record<string, unknown> = {},
): T {
  const now = new Date().toISOString();
  const data = { ...values, id: randomUUID(), createdAt: now, updatedAt: now };
  db.prepare(
    "INSERT INTO records(id,user_id,collection,data,secret,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
  ).run(
    data.id,
    userId,
    collection,
    JSON.stringify(data),
    JSON.stringify(secret),
    now,
    now,
  );
  return data as T;
}
export function updateEntity<T = Entity>(
  userId: string,
  collection: string,
  id: string,
  patch: Record<string, unknown>,
): T {
  const old = requireEntity<Entity>(userId, collection, id);
  const data = {
    ...old,
    ...patch,
    id: old.id,
    createdAt: old.createdAt,
    updatedAt: new Date().toISOString(),
  };
  db.prepare(
    "UPDATE records SET data=?,updated_at=? WHERE id=? AND user_id=? AND collection=?",
  ).run(JSON.stringify(data), data.updatedAt, id, userId, collection);
  return data as T;
}
export function deleteEntity(
  userId: string,
  collection: string,
  id: string,
): void {
  requireEntity(userId, collection, id);
  db.prepare(
    "DELETE FROM records WHERE id=? AND user_id=? AND collection=?",
  ).run(id, userId, collection);
}
export function getSecret<T = Record<string, unknown>>(
  userId: string,
  collection: string,
  id: string,
): T {
  const row = db
    .prepare(
      "SELECT secret FROM records WHERE user_id=? AND collection=? AND id=?",
    )
    .get(userId, collection, id) as { secret: string } | undefined;
  if (!row) throw new ApiError("العنصر غير موجود.", 404);
  return JSON.parse(row.secret);
}
export function setSecret(
  userId: string,
  collection: string,
  id: string,
  secret: Record<string, unknown>,
) {
  requireEntity(userId, collection, id);
  db.prepare(
    "UPDATE records SET secret=? WHERE id=? AND user_id=? AND collection=?",
  ).run(JSON.stringify(secret), id, userId, collection);
}
export function preferences(userId: string): Preferences {
  const row = db
    .prepare("SELECT preferences FROM users WHERE id=?")
    .get(userId) as { preferences: string } | undefined;
  if (!row) throw new ApiError("يرجى تسجيل الدخول.", 401);
  return { ...DEFAULT_PREFERENCES, ...JSON.parse(row.preferences) };
}
export function savePreferences(
  userId: string,
  values: Preferences,
): Preferences {
  db.prepare("UPDATE users SET preferences=? WHERE id=?").run(
    JSON.stringify(values),
    userId,
  );
  return values;
}
export function getState(userId: string): AppState {
  const collections = [
    "lessonAttempts",
    "answers",
    "reviews",
    "reviewEvents",
    "associations",
    "palaceTrials",
    "notes",
    "tasks",
    "habits",
    "goals",
    "projects",
    "studySessions",
    "subjects",
    "voiceAssets",
    "weeklyReviews",
    "insightFeedback",
  ];
  const result: Record<string, unknown> = { preferences: preferences(userId) };
  for (const c of collections) result[c] = listEntities(userId, c);
  return result as AppState;
}
export function idempotent<T>(
  userId: string,
  key: string,
  action: string,
  fn: () => T,
): T {
  if (!key || key.length > 150) throw new ApiError("معرّف الحفظ غير صالح.");
  const row = db
    .prepare("SELECT action,result FROM idempotency WHERE user_id=? AND key=?")
    .get(userId, key) as { action: string; result: string } | undefined;
  if (row) {
    if (row.action !== action)
      throw new ApiError("تم استخدام معرّف الطلب لعملية أخرى.", 409);
    return JSON.parse(row.result);
  }
  const result = fn();
  db.prepare(
    "INSERT INTO idempotency(user_id,key,action,result) VALUES(?,?,?,?)",
  ).run(userId, key, action, JSON.stringify(result));
  return result;
}

export function drainFileCleanup(): number {
  const rows = db.prepare("SELECT path FROM file_cleanup").all() as {
    path: string;
  }[];
  for (const { path } of rows) {
    if (!path.startsWith(join(DATA_DIR, "voice") + "/")) continue;
    try {
      rmSync(path, { recursive: true, force: true });
      db.prepare("DELETE FROM file_cleanup WHERE path=?").run(path);
    } catch {
      console.error("MQW file deletion pending; restart retries cleanup.");
    }
  }
  return Number(
    (
      db.prepare("SELECT COUNT(*) AS n FROM file_cleanup").get() as {
        n: number;
      }
    ).n,
  );
}
drainFileCleanup();
