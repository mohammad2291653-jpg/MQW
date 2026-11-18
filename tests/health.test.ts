import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "mqw-health-"));
process.env.MQW_DATA_DIR = dir;
delete process.env.MQW_DATABASE_URL;
process.env.MQW_STORAGE_BACKEND = "sqlite";
const route =
  require("../src/app/api/health/route") as typeof import("../src/app/api/health/route");
after(() => rmSync(dir, { recursive: true, force: true }));
test("readiness checks the real database without returning private details or creating accounts", async () => {
  const healthy = await route.GET();
  assert.equal(healthy.status, 200);
  assert.equal(healthy.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await healthy.json(), { data: { status: "ok" } });
  const { db } =
    require("../src/lib/server/db") as typeof import("../src/lib/server/db");
  assert.equal(
    (
      (await db.prepare("SELECT COUNT(*) AS n FROM users").get()) as {
        n: number;
      }
    ).n,
    0,
  );
  await db.close();
  const unavailable = await route.GET();
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), {
    data: { status: "unavailable" },
  });
});
