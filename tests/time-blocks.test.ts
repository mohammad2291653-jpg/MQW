import { after, test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "mqw-time-blocks-"));
process.env.MQW_DATA_DIR = dir;
delete process.env.MQW_DATABASE_URL;
process.env.MQW_STORAGE_BACKEND = "sqlite";
const { db, getState } =
  require("../src/lib/server/db") as typeof import("../src/lib/server/db");
const { signUp } =
  require("../src/lib/server/auth") as typeof import("../src/lib/server/auth");
const { createRecord, patchRecord, patchPreferences } =
  require("../src/lib/server/records") as typeof import("../src/lib/server/records");
let owner: Awaited<ReturnType<typeof signUp>>;
let other: Awaited<ReturnType<typeof signUp>>;
before(async () => {
  owner = await signUp(
    "time-owner@example.test",
    "private-time-password",
    "Owner",
  );
  other = await signUp(
    "time-other@example.test",
    "private-time-password",
    "Other",
  );
});
const block = {
  date: "2030-11-18",
  start: "09:15",
  end: "10:30",
  timezone: "Asia/Hebron",
};
after(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});
test("task plans preserve local wall-time without changing importance or inventing deadlines", async () => {
  const task = await createRecord(owner.user.id, "tasks", {
    title: "مساحة للمراجعة",
    importance: 3,
    done: false,
    timeBlock: block,
  });
  assert.deepEqual(task.timeBlock, block);
  assert.equal(task.importance, 3);
  assert.equal(task.dueDate, undefined);
  await patchPreferences(owner.user.id, { timezone: "America/Los_Angeles" });
  const saved = (await getState(owner.user.id)).tasks.find(
    (row) => row.id === task.id,
  );
  assert.deepEqual(saved?.timeBlock, block);
  assert.equal(saved?.importance, 3);
  const edited = await patchRecord(owner.user.id, "tasks", task.id, {
    title: "تعديل العنوان فقط",
  });
  assert.deepEqual(edited.timeBlock, block);
  assert.equal(edited.importance, 3);
  const cleared = await patchRecord(owner.user.id, "tasks", task.id, {
    timeBlock: null,
  });
  assert.equal(cleared.timeBlock, null);
  assert.equal(cleared.importance, 3);
  assert.equal(
    (await getState(owner.user.id)).tasks.find((row) => row.id === task.id)
      ?.timeBlock,
    null,
  );
});
test("task plans reject invalid local dates, malformed clocks, reversed intervals and non-IANA zones", async () => {
  const invalid = [
    { ...block, date: "2030-02-30" },
    { ...block, date: "2030-13-01" },
    { ...block, date: "2030-1-1" },
    { ...block, start: "24:00" },
    { ...block, start: "9:15" },
    { ...block, start: "09:15:30" },
    { ...block, end: "09:15" },
    { ...block, end: "08:45" },
    { ...block, timezone: "made-up/zone" },
    { ...block, timezone: "+02:00" },
    { ...block, timezone: "PST" },
    { date: block.date, start: block.start, end: block.end },
    [],
    "tomorrow",
    false,
  ];
  for (const timeBlock of invalid) {
    await assert.rejects(
      async () =>
        await createRecord(owner.user.id, "tasks", {
          title: "وقت غير صالح",
          importance: 2,
          timeBlock,
        }),
    );
  }
  const utc = await createRecord(owner.user.id, "tasks", {
    title: "وقت UTC",
    importance: 1,
    timeBlock: { ...block, timezone: "UTC" },
  });
  assert.equal((utc.timeBlock as typeof block).timezone, "UTC");
});
test("time planning remains optional and cannot bypass task ownership", async () => {
  const task = await createRecord(owner.user.id, "tasks", {
    title: "مهمة مرنة",
    importance: 2,
  });
  assert.equal(task.timeBlock, undefined);
  await assert.rejects(
    async () =>
      await patchRecord(other.user.id, "tasks", task.id, { timeBlock: block }),
  );
  assert.equal((await getState(other.user.id)).tasks.length, 0);
  assert.equal(
    (await getState(owner.user.id)).tasks.find((row) => row.id === task.id)
      ?.timeBlock,
    undefined,
  );
});
