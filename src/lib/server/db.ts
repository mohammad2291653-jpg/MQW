import { DatabaseSync } from "node:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { AppState, Entity, Preferences } from "../types";
import { EVO_STATE_COLLECTIONS } from "./evolution-collections";

type Row = Record<string, any>;
type Context = { client?: PoolClient; owner?: string; active: boolean };
type SharedDatabase = {
  sqlite?: DatabaseSync;
  pool?: Pool;
  context: AsyncLocalStorage<Context>;
  sqliteTail: Promise<void>;
  closed: boolean;
  closePromise?: Promise<void>;
};
const selected =
  process.env.MQW_STORAGE_BACKEND ||
  (process.env.MQW_DATABASE_URL ? "postgres" : "sqlite");
if (selected !== "sqlite" && selected !== "postgres")
  throw new Error("Unknown MQW storage backend");
export const storageBackend = selected;
export const DATA_DIR = process.env.MQW_DATA_DIR || join(process.cwd(), "data");
const registrySymbol = Symbol.for("mqw.shared-database.v1");
const globalRegistry = globalThis as typeof globalThis & {
  [registrySymbol]?: Map<string, SharedDatabase>;
};
const registry = (globalRegistry[registrySymbol] ||= new Map<
  string,
  SharedDatabase
>());
// The registry must never expose the raw connection URL as a key or in diagnostics.
const cacheKey =
  storageBackend === "postgres"
    ? `postgres:${createHash("sha256")
        .update(process.env.MQW_DATABASE_URL || "")
        .update("\0")
        .update(process.env.MQW_DATABASE_CA_CERT || "")
        .digest("hex")}`
    : `sqlite:${resolve(DATA_DIR, "mqw.sqlite")}`;
function initialize(): SharedDatabase {
  const value: SharedDatabase = {
    context: new AsyncLocalStorage<Context>(),
    sqliteTail: Promise.resolve(),
    closed: false,
  };
  if (storageBackend === "postgres") {
    if (!process.env.MQW_DATABASE_URL)
      throw new Error("MQW_DATABASE_URL is required");
    const connection = new URL(process.env.MQW_DATABASE_URL);
    if (
      connection.protocol !== "postgresql:" &&
      connection.protocol !== "postgres:"
    )
      throw new Error("Invalid database protocol");
    if (
      ["disable", "no-verify"].includes(
        connection.searchParams.get("sslmode") || "",
      )
    )
      throw new Error("Verified database TLS is required");
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
      connection.searchParams.delete(key);
    value.pool = new Pool({
      connectionString: connection.toString(),
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      application_name: "mqw",
      options: "-c search_path=mqw_private,pg_catalog",
      ssl: {
        rejectUnauthorized: true,
        ...(process.env.MQW_DATABASE_CA_CERT
          ? { ca: process.env.MQW_DATABASE_CA_CERT }
          : {}),
      },
    });
    value.pool.on("error", () =>
      console.error("MQW database connection interrupted."),
    );
  } else {
    mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    value.sqlite = new DatabaseSync(resolve(DATA_DIR, "mqw.sqlite"), {
      timeout: 5000,
    });
    // Install lock waiting before WAL mode or any schema work in concurrent build workers.
    value.sqlite.exec("PRAGMA busy_timeout=5000;");
    value.sqlite.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,preferences TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,collection TEXT NOT NULL,data TEXT NOT NULL,secret TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS records_owner ON records(user_id,collection);
CREATE TABLE IF NOT EXISTS setup_tokens (token_hash TEXT PRIMARY KEY,consumed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS file_cleanup (path TEXT PRIMARY KEY,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS idempotency (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,key TEXT NOT NULL,action TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(user_id,key));`);
  }
  return value;
}
const cached = registry.get(cacheKey);
const shared =
  cached && !cached.closed && !cached.closePromise ? cached : initialize();
if (shared !== cached) registry.set(cacheKey, shared);
const { sqlite, pool, context } = shared;
async function exclusive<T>(fn: () => T | Promise<T>): Promise<T> {
  const previous = shared.sqliteTail;
  let release!: () => void;
  shared.sqliteTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}
function current() {
  const value = context.getStore();
  if (value && !value.active)
    throw new Error("Database work escaped its transaction");
  return value;
}
function placeholders(sql: string) {
  let index = 0;
  // All application SQL is static; placeholders never occur inside string literals.
  return sql.replace(/\?/g, () => `$${++index}`);
}
export async function query(
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: Row[]; rowCount: number }> {
  const ctx = current();
  if (pool) {
    const result = await (ctx?.client || pool).query(placeholders(sql), params);
    return { rows: result.rows || [], rowCount: result.rowCount || 0 };
  }
  const run = () => {
    const statement = sqlite!.prepare(sql);
    const values = params.map((value) =>
      value === undefined
        ? null
        : typeof value === "boolean"
          ? Number(value)
          : value,
    ) as Parameters<typeof statement.all>;
    if (
      /^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(sql) ||
      /\bRETURNING\b/i.test(sql)
    ) {
      const rows = statement.all(...values) as Row[];
      return { rows, rowCount: rows.length };
    }
    const result = statement.run(...values);
    return { rows: [], rowCount: Number(result.changes) };
  };
  return ctx ? run() : exclusive(run);
}
export const db = {
  prepare(sql: string) {
    return {
      async all(...params: unknown[]): Promise<Row[]> {
        return (await query(sql, params)).rows;
      },
      async get(...params: unknown[]): Promise<Row | undefined> {
        return (await query(sql, params)).rows[0];
      },
      async run(...params: unknown[]) {
        const result = await query(sql, params);
        return { changes: result.rowCount };
      },
    };
  },
  async exec(sql: string): Promise<void> {
    if (pool) {
      await query(sql);
      return;
    }
    if (current()) sqlite!.exec(sql);
    else await exclusive(() => sqlite!.exec(sql));
  },
  async close(): Promise<void> {
    if (!shared.closePromise) {
      shared.closePromise = (async () => {
        try {
          if (pool) await pool.end();
          else await exclusive(() => sqlite!.close());
        } finally {
          shared.closed = true;
          if (registry.get(cacheKey) === shared) registry.delete(cacheKey);
        }
      })();
    }
    return shared.closePromise;
  },
};
export async function transaction<T>(fn: () => T | Promise<T>): Promise<T> {
  if (current()) return await fn();
  if (pool) {
    const client = await pool.connect();
    const ctx: Context = { client, active: true };
    try {
      await client.query("BEGIN");
      // Serialize evidence/idempotency transitions across instances as SQLite did.
      await client.query("SELECT pg_advisory_xact_lock(670089)");
      const result = await context.run(ctx, fn);
      ctx.active = false;
      await client.query("COMMIT");
      return result;
    } catch (error) {
      ctx.active = false;
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      ctx.active = false;
      client.release();
    }
  }
  return exclusive(async () => {
    const ctx: Context = { active: true };
    sqlite!.exec("BEGIN IMMEDIATE");
    try {
      const result = await context.run(ctx, fn);
      sqlite!.exec("COMMIT");
      return result;
    } catch (error) {
      sqlite!.exec("ROLLBACK");
      throw error;
    } finally {
      ctx.active = false;
    }
  });
}
export async function withOwner<T>(
  userId: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  if (!current()) return transaction(() => withOwner(userId, fn));
  const ctx = current()!;
  if (ctx.owner && ctx.owner !== userId)
    throw new Error("Cannot change transaction owner");
  if (!ctx.owner) {
    ctx.owner = userId;
    if (ctx.client)
      await ctx.client.query("SELECT set_config('mqw.user_id',$1,true)", [
        userId,
      ]);
  }
  return await fn();
}
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
function validId(id: string) {
  return (
    storageBackend !== "postgres" ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}
export async function listEntities<T = Entity>(
  userId: string,
  collection: string,
): Promise<T[]> {
  return withOwner(userId, async () =>
    (
      await db
        .prepare(
          "SELECT data FROM records WHERE user_id=? AND collection=? ORDER BY created_at DESC,id",
        )
        .all(userId, collection)
    ).map((r) => JSON.parse(r.data)),
  );
}
export async function getEntity<T = Entity>(
  userId: string,
  collection: string,
  id: string,
): Promise<T | undefined> {
  if (!validId(id)) return undefined;
  return withOwner(userId, async () => {
    const row = await db
      .prepare(
        "SELECT data FROM records WHERE user_id=? AND collection=? AND id=?",
      )
      .get(userId, collection, id);
    return row ? JSON.parse(row.data) : undefined;
  });
}
export async function requireEntity<T = Entity>(
  userId: string,
  collection: string,
  id: string,
): Promise<T> {
  const value = await getEntity<T>(userId, collection, id);
  if (!value)
    throw new ApiError("العنصر غير موجود أو غير متاح لهذا الحساب.", 404);
  return value;
}
export async function createEntity<T = Entity>(
  userId: string,
  collection: string,
  values: Record<string, unknown>,
  secret: Record<string, unknown> = {},
): Promise<T> {
  return withOwner(userId, async () => {
    const now = new Date().toISOString();
    const data = {
      ...values,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await db
      .prepare(
        "INSERT INTO records(id,user_id,collection,data,secret,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        data.id,
        userId,
        collection,
        JSON.stringify(data),
        JSON.stringify(secret),
        now,
        now,
      );
    return data as T;
  });
}
export async function updateEntity<T = Entity>(
  userId: string,
  collection: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<T> {
  return withOwner(userId, async () => {
    const old = await requireEntity<Entity>(userId, collection, id);
    const data = {
      ...old,
      ...patch,
      id: old.id,
      createdAt: old.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await db
      .prepare(
        "UPDATE records SET data=?,updated_at=? WHERE id=? AND user_id=? AND collection=?",
      )
      .run(JSON.stringify(data), data.updatedAt, id, userId, collection);
    return data as T;
  });
}
export async function deleteEntity(
  userId: string,
  collection: string,
  id: string,
): Promise<void> {
  await withOwner(userId, async () => {
    await requireEntity(userId, collection, id);
    await db
      .prepare("DELETE FROM records WHERE id=? AND user_id=? AND collection=?")
      .run(id, userId, collection);
  });
}
export async function getSecret<T = Record<string, unknown>>(
  userId: string,
  collection: string,
  id: string,
): Promise<T> {
  return withOwner(userId, async () => {
    if (!validId(id)) throw new ApiError("العنصر غير موجود.", 404);
    const row = await db
      .prepare(
        "SELECT secret FROM records WHERE user_id=? AND collection=? AND id=?",
      )
      .get(userId, collection, id);
    if (!row) throw new ApiError("العنصر غير موجود.", 404);
    return JSON.parse(row.secret);
  });
}
export async function setSecret(
  userId: string,
  collection: string,
  id: string,
  secret: Record<string, unknown>,
): Promise<void> {
  await withOwner(userId, async () => {
    await requireEntity(userId, collection, id);
    await db
      .prepare(
        "UPDATE records SET secret=? WHERE id=? AND user_id=? AND collection=?",
      )
      .run(JSON.stringify(secret), id, userId, collection);
  });
}
export async function preferences(userId: string): Promise<Preferences> {
  const row = await db
    .prepare("SELECT preferences FROM users WHERE id=?")
    .get(userId);
  if (!row) throw new ApiError("يرجى تسجيل الدخول.", 401);
  return { ...DEFAULT_PREFERENCES, ...JSON.parse(row.preferences) };
}
export async function savePreferences(
  userId: string,
  values: Preferences,
): Promise<Preferences> {
  await db
    .prepare("UPDATE users SET preferences=? WHERE id=?")
    .run(JSON.stringify(values), userId);
  return values;
}
let mediaTableSeen = false;
let mediaTableCheckedAt = 0;
/**
 * Private photo bytes need a private store: local files (SQLite) or the
 * owner-approved `mqw_private.media_blobs` table (PostgreSQL). Until that
 * migration exists, cloud photo features stay disabled automatically.
 */
export async function privatePhotosAvailable(): Promise<boolean> {
  if (storageBackend === "sqlite") return true;
  if (mediaTableSeen) return true;
  if (Date.now() - mediaTableCheckedAt < 60000) return false;
  mediaTableCheckedAt = Date.now();
  try {
    const row = (
      await query(
        "SELECT to_regclass('mqw_private.media_blobs') IS NOT NULL AS ok",
      )
    ).rows[0];
    mediaTableSeen = row?.ok === true;
  } catch {
    mediaTableSeen = false;
  }
  return mediaTableSeen;
}
export async function getState(userId: string): Promise<AppState> {
  return withOwner(userId, async () => {
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
      ...EVO_STATE_COLLECTIONS,
    ];
    const result: Record<string, unknown> = {
      preferences: await preferences(userId),
      // Private photo bytes are only enabled where a private store exists (local files).
      capabilities: { privatePhotos: await privatePhotosAvailable() },
    };
    for (const collection of collections) result[collection] = [];
    const rows = await db
      .prepare(
        "SELECT collection,data FROM records WHERE user_id=? ORDER BY created_at DESC,id",
      )
      .all(userId);
    for (const row of rows)
      if (collections.includes(row.collection))
        (result[row.collection] as Entity[]).push(JSON.parse(row.data));
    return result as AppState;
  });
}
export async function idempotent<T>(
  userId: string,
  key: string,
  action: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  return withOwner(userId, async () => {
    if (!key || key.length > 150) throw new ApiError("معرّف الحفظ غير صالح.");
    const row = await db
      .prepare(
        "SELECT action,result FROM idempotency WHERE user_id=? AND key=?",
      )
      .get(userId, key);
    if (row) {
      if (row.action !== action)
        throw new ApiError("تم استخدام معرّف الطلب لعملية أخرى.", 409);
      return JSON.parse(row.result);
    }
    const result = await fn();
    await db
      .prepare(
        "INSERT INTO idempotency(user_id,key,action,result) VALUES(?,?,?,?)",
      )
      .run(userId, key, action, JSON.stringify(result));
    return result;
  });
}
export async function drainFileCleanup(): Promise<number> {
  if (storageBackend === "postgres") return 0;
  return transaction(async () => {
    const rows = await db.prepare("SELECT path FROM file_cleanup").all();
    for (const { path } of rows) {
      if (
        !path.startsWith(join(DATA_DIR, "voice") + "/") &&
        !path.startsWith(join(DATA_DIR, "media") + "/")
      )
        continue;
      try {
        rmSync(path, { recursive: true, force: true });
        await db.prepare("DELETE FROM file_cleanup WHERE path=?").run(path);
      } catch {
        console.error("MQW file deletion pending; restart retries cleanup.");
      }
    }
    return Number(
      (await db.prepare("SELECT COUNT(*) AS n FROM file_cleanup").get())!.n,
    );
  });
}
void drainFileCleanup().catch(() =>
  console.error("MQW pending file cleanup could not finish."),
);
