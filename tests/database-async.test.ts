import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";

const dir = mkdtempSync(join(tmpdir(), "mqw-async-db-"));
process.env.MQW_DATA_DIR = dir;
delete process.env.MQW_DATABASE_URL;
process.env.MQW_STORAGE_BACKEND = "sqlite";
const { db, transaction } =
  require("../src/lib/server/db") as typeof import("../src/lib/server/db");

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

before(async () => {
  await db.exec("CREATE TABLE async_test_values (id TEXT PRIMARY KEY)");
});

after(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test(
  "transactions await their callback and outside reads cannot observe uncommitted writes",
  { timeout: 5_000 },
  async () => {
    const entered = gate();
    const resume = gate();
    let committed = false;
    const writing = transaction(async () => {
      await db
        .prepare("INSERT INTO async_test_values(id) VALUES(?)")
        .run("first");
      entered.release();
      await resume.promise;
      await db
        .prepare("INSERT INTO async_test_values(id) VALUES(?)")
        .run("second");
      return "committed result";
    }).then((result) => {
      committed = true;
      return result;
    });

    let outsideRead: Promise<string[]> | undefined;
    try {
      await entered.promise;
      assert.equal(committed, false);
      let readFinished = false;
      outsideRead = db
        .prepare("SELECT id FROM async_test_values ORDER BY id")
        .all()
        .then((rows) => {
          readFinished = true;
          return rows.map((row) => row.id as string);
        });
      await setImmediate();
      assert.equal(
        readFinished,
        false,
        "an unrelated read must wait until the active SQLite transaction settles",
      );
    } finally {
      resume.release();
      await writing;
    }

    assert.equal(await writing, "committed result");
    assert.deepEqual(await outsideRead, ["first", "second"]);
  },
);

test(
  "a rejection after an asynchronous boundary rolls back all writes",
  { timeout: 5_000 },
  async () => {
    await assert.rejects(
      transaction(async () => {
        await db
          .prepare("INSERT INTO async_test_values(id) VALUES(?)")
          .run("rolled-back");
        await setImmediate();
        throw new Error("asynchronous rollback marker");
      }),
      /asynchronous rollback marker/,
    );
    assert.equal(
      await db
        .prepare("SELECT id FROM async_test_values WHERE id=?")
        .get("rolled-back"),
      undefined,
    );
  },
);

test(
  "concurrent SQLite transactions serialize their entire asynchronous callbacks",
  { timeout: 5_000 },
  async () => {
    const entered = gate();
    const resume = gate();
    const events: string[] = [];
    const first = transaction(async () => {
      events.push("first entered");
      entered.release();
      await resume.promise;
      await db
        .prepare("INSERT INTO async_test_values(id) VALUES(?)")
        .run("serialized-first");
      events.push("first finished");
    });
    await entered.promise;
    const second = transaction(async () => {
      events.push("second entered");
      const prior = await db
        .prepare("SELECT id FROM async_test_values WHERE id=?")
        .get("serialized-first");
      assert.equal(prior?.id, "serialized-first");
      events.push("second finished");
    });
    try {
      await setImmediate();
      assert.deepEqual(events, ["first entered"]);
    } finally {
      resume.release();
      await Promise.all([first, second]);
    }
    assert.deepEqual(events, [
      "first entered",
      "first finished",
      "second entered",
      "second finished",
    ]);
  },
);

test(
  "reloaded modules share transaction context, isolation and safe connection replacement",
  { timeout: 5_000 },
  async () => {
    type Driver = typeof import("../src/lib/server/db");
    const modulePath = require.resolve("../src/lib/server/db");
    const reload = (): Driver => {
      delete require.cache[modulePath];
      return require(modulePath) as Driver;
    };
    const other = reload();
    assert.notEqual(
      other.db,
      db,
      "the regression needs distinct module copies",
    );
    const entered = gate();
    const resume = gate();
    const events: string[] = [];
    const writing = transaction(async () => {
      await db
        .prepare("INSERT INTO async_test_values(id) VALUES(?)")
        .run("module-outer");
      await other.transaction(async () => {
        await other.db
          .prepare("INSERT INTO async_test_values(id) VALUES(?)")
          .run("module-nested");
        events.push("nested completed");
      });
      entered.release();
      await resume.promise;
      events.push("outer completed");
    });
    let reading: Promise<Record<string, unknown> | undefined> | undefined;
    let queued: Promise<void> | undefined;
    let fresh: Driver | undefined;
    let latest: Driver | undefined;
    try {
      await entered.promise;
      let readFinished = false;
      reading = other.db
        .prepare("SELECT id FROM async_test_values WHERE id=?")
        .get("module-outer")
        .then((row) => {
          readFinished = true;
          return row;
        });
      queued = other.transaction(async () => {
        events.push("queued entered");
      });
      try {
        await setImmediate();
        assert.equal(readFinished, false);
        assert.deepEqual(events, ["nested completed"]);
      } finally {
        resume.release();
        await Promise.all([writing, reading, queued]);
      }
      assert.equal((await reading)?.id, "module-outer");
      assert.deepEqual(events, [
        "nested completed",
        "outer completed",
        "queued entered",
      ]);

      // Replacement happens while closing is pending, so the old close callback
      // must leave the newer entry in the shared registry intact.
      const closing = other.db.close();
      fresh = reload();
      await closing;
      await assert.rejects(db.prepare("SELECT 1").get());
      assert.equal(
        (
          await fresh.db
            .prepare("SELECT id FROM async_test_values WHERE id=?")
            .get("module-nested")
        )?.id,
        "module-nested",
      );
      await db.close();
      await other.db.close();
      latest = reload();
      await fresh.db.close();
      await assert.rejects(
        latest.db.prepare("SELECT 1").get(),
        "later module copies must still share the replacement connection",
      );
    } finally {
      resume.release();
      await Promise.allSettled([writing, reading, queued]);
      await other.db.close();
      await fresh?.db.close();
      await latest?.db.close();
    }
  },
);
