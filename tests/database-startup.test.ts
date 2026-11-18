import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const workerCode = `
  const start = new Promise(resolve => process.once('message', resolve));
  process.send({ ready: true });
  await start;
  try {
    const module = await import(process.env.MQW_STARTUP_TEST_MODULE);
    const { db } = module.default || module;
    const timeout = await db.prepare('PRAGMA busy_timeout').get();
    const journal = await db.prepare('PRAGMA journal_mode').get();
    const integrity = await db.prepare('PRAGMA quick_check').get();
    const tables = await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('users','sessions','records','setup_tokens','file_cleanup','idempotency')").get();
    await db.close();
    process.send({ ok: true, timeout: Object.values(timeout)[0], journal: Object.values(journal)[0], integrity: Object.values(integrity)[0], tables: tables.n });
  } catch(error) {
    process.send({ ok: false, errorName: error?.name, errorCode: error?.code, sqliteCode: error?.errcode });
    process.exitCode = 1;
  } finally { process.disconnect(); }
`;
type Result = {
  ready?: boolean;
  ok?: boolean;
  timeout?: number;
  journal?: string;
  integrity?: string;
  tables?: number;
  errorName?: string;
  errorCode?: string;
  sqliteCode?: number;
};
function worker(directory: string) {
  const env = { ...process.env };
  for (const key of [
    "MQW_DATABASE_URL",
    "MQW_DATABASE_CA_CERT",
    "MQW_OWNER_EMAIL",
    "MQW_SETUP_TOKEN_HASH",
    "NODE_ENV",
  ])
    delete env[key];
  Object.assign(env, {
    MQW_STORAGE_BACKEND: "sqlite",
    MQW_DATA_DIR: directory,
    MQW_STARTUP_TEST_MODULE: pathToFileURL(resolve("src/lib/server/db.ts"))
      .href,
  });
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", workerCode],
    { env, stdio: ["ignore", "pipe", "pipe", "ipc"] },
  );
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  let doneResolve!: (result: Result) => void;
  let doneReject!: (error: Error) => void;
  let isReady = false;
  let result: Result | undefined;
  let stderr = "";
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const done = new Promise<Result>((resolve, reject) => {
    doneResolve = resolve;
    doneReject = reject;
  });
  // Cleanup can terminate workers whose promises have not yet reached Promise.all.
  void ready.catch(() => {});
  void done.catch(() => {});
  child.stderr?.on("data", (chunk) => {
    stderr += String(chunk).slice(0, 4096 - stderr.length);
  });
  child.on("message", (message: Result) => {
    if (message.ready) {
      isReady = true;
      readyResolve();
    } else result = message;
  });
  child.once("error", (error) => {
    readyReject(error);
    doneReject(error);
  });
  child.once("exit", (code) => {
    if (!isReady)
      readyReject(
        new Error("SQLite startup worker exited before its start barrier."),
      );
    if (
      code !== 0 ||
      !result?.ok ||
      /database is locked|SQLITE_BUSY|pending file cleanup could not finish/i.test(
        stderr,
      )
    )
      doneReject(
        new Error(
          `Concurrent SQLite startup failed: ${JSON.stringify(result || { exitCode: code })}`,
        ),
      );
    else doneResolve(result);
  });
  return { child, ready, done };
}
test(
  "fresh concurrent Node workers initialize SQLite WAL/schema without startup lock errors",
  { timeout: 45000 },
  async () => {
    const root = mkdtempSync(join(tmpdir(), "mqw-cold-startup-"));
    const children = new Set<ChildProcess>();
    const deadline = setTimeout(() => {
      for (const child of children) child.kill("SIGKILL");
    }, 40000);
    deadline.unref();
    try {
      // Each round starts from a new, absent database; all six imports leave an IPC barrier together.
      for (let round = 0; round < 3; round++) {
        const directory = join(root, `cold-${round}`);
        mkdirSync(directory);
        const workers = Array.from({ length: 6 }, () => worker(directory));
        for (const item of workers) children.add(item.child);
        try {
          await Promise.all(workers.map((item) => item.ready));
          for (const item of workers) item.child.send({ start: true });
          const results = await Promise.all(workers.map((item) => item.done));
          for (const result of results) {
            assert.equal(result.timeout, 5000);
            assert.equal(result.journal, "wal");
            assert.equal(result.integrity, "ok");
            assert.equal(result.tables, 6);
          }
        } finally {
          for (const item of workers)
            if (item.child.exitCode === null && item.child.signalCode === null)
              item.child.kill("SIGKILL");
          await Promise.allSettled(workers.map((item) => item.done));
          for (const item of workers) children.delete(item.child);
        }
      }
    } finally {
      clearTimeout(deadline);
      for (const child of children) child.kill("SIGKILL");
      rmSync(root, { recursive: true, force: true });
    }
  },
);
