/**
 * OPT IN ONLY. Never picked up by `npm test` or Playwright.
 * MQW 90 + private photo checks against a disposable LOCAL PostgreSQL that has
 * the reviewed runtime schema (supabase/runtime/schema.sql).
 *
 *   Phase "before": media migration NOT applied → photos must be disabled.
 *   Phase "after":  supabase/proposals/mqw90_private_media.sql applied → photos
 *                   work, stay owner-private (app + RLS), export and cascade.
 *
 * Run: MQW_PG_SMOKE=1 MQW_PG_SMOKE_PHASE=before|after MQW_STORAGE_BACKEND=postgres \
 *      MQW_DATABASE_URL=... MQW_DATABASE_CA_CERT=... \
 *      MQW_PG_SMOKE_TARGET='localhost:PORT/mqw_smoke' npx tsx tests/postgres-evolution.smoke.ts
 * All data is synthetic and every account created here is deleted at the end.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

let stage = "opt-in and disposable-target validation";
async function main() {
  if (process.env.MQW_PG_SMOKE !== "1") {
    console.log("MQW 90 PostgreSQL smoke skipped: MQW_PG_SMOKE=1 required.");
    return;
  }
  const phase = process.env.MQW_PG_SMOKE_PHASE;
  assert.ok(
    phase === "before" || phase === "after",
    "Phase must be before|after.",
  );
  assert.equal(process.env.MQW_STORAGE_BACKEND, "postgres");
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED, "0");
  assert.ok(!process.env.MQW_OWNER_EMAIL && !process.env.MQW_SETUP_TOKEN_HASH);
  const target = new URL(process.env.MQW_DATABASE_URL!);
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname),
    "Loopback only.",
  );
  assert.equal(
    target.pathname,
    "/mqw_smoke",
    "Dedicated disposable database only.",
  );
  assert.equal(
    process.env.MQW_PG_SMOKE_TARGET,
    `${target.hostname}:${target.port || "5432"}${target.pathname}`,
  );

  const database = await import("../src/lib/server/db");
  const auth = await import("../src/lib/server/auth");
  const records = await import("../src/lib/server/records");
  const media = await import("../src/lib/server/media");
  const { PILLAR_DATA } = await import("../src/lib/server/evolution");
  const exportRoute = await import("../src/app/api/export/route");
  const accountRoute = await import("../src/app/api/account/route");
  const { query, withOwner, transaction, getState, getEntity } = database;
  const origin = process.env.MQW_APP_ORIGIN || "http://localhost";
  const accounts: { id: string; token: string; password: string }[] = [];
  const create = (u: string, c: string, v: Record<string, unknown>) =>
    withOwner(u, () =>
      transaction(() => records.createRecord(u, c, v)),
    ) as Promise<any>;
  const patch = (
    u: string,
    c: string,
    id: string,
    v: Record<string, unknown>,
  ) =>
    withOwner(u, () =>
      transaction(() => records.patchRecord(u, c, id, v)),
    ) as Promise<any>;
  const summary: string[] = [];
  try {
    stage = "restricted runtime role over verified TLS";
    const role = (
      await query(
        "SELECT current_user AS u, (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass, (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS ssl",
      )
    ).rows[0];
    assert.equal(role.u, "mqw_app");
    assert.equal(role.bypass, false);
    assert.equal(role.ssl, true);
    summary.push("runtime role mqw_app, no RLS bypass, TLS verified");

    stage = "synthetic accounts";
    for (const who of ["a", "b"]) {
      const password = `Synthetic-${randomUUID()}`;
      const result = await auth.signUp(
        `evo-smoke-${who}-${Date.now()}@mqw.test`,
        password,
        `smoke-${who}`,
      );
      accounts.push({ id: result.user.id, token: result.token, password });
    }
    const [A, B] = accounts;

    stage = "MQW 90 records in mqw_private.records";
    const cycle = await create(A.id, "evoCycles", {
      startDate: "2026-11-01",
      timezone: "Asia/Hebron",
      state: "active",
      goals: [{ title: "هدف اصطناعي" }],
    });
    assert.equal(cycle.pillars.wellbeing, false);
    const sup = await create(A.id, "evoSupplements", {
      name: "عنصر اصطناعي",
      startDate: "2026-11-01",
      schedule: { kind: "daily", times: ["08:00"] },
    });
    const i1 = await create(A.id, "evoIntakes", {
      supplementId: sup.id,
      date: "2026-11-02",
      time: "08:00",
      status: "taken",
    });
    const i2 = await create(A.id, "evoIntakes", {
      supplementId: sup.id,
      date: "2026-11-02",
      time: "08:00",
      status: "taken",
    });
    assert.equal(i1.id, i2.id, "idempotent intake");
    const edited = await patch(A.id, "evoSupplements", sup.id, {
      schedule: { kind: "interval", every: 2 },
    });
    assert.equal(edited.scheduleHistory.length, 2);
    await assert.rejects(() =>
      create(A.id, "evoRoutineEvents", {
        pillar: "hair",
        area: "scalp",
        kind: "microneedling",
        date: "2026-11-02",
      }),
    );
    await assert.rejects(() =>
      create(A.id, "evoWellbeing", { date: "2026-11-02", mood: 3 }),
    );
    const ex = await create(A.id, "evoExercises", { name: "تمرين اصطناعي" });
    await create(A.id, "evoWorkouts", {
      templateName: "Push",
      type: "push",
      date: "2026-11-02",
      startedAt: new Date().toISOString(),
      sets: [
        {
          id: "s1",
          exerciseId: ex.id,
          exerciseName: "تمرين اصطناعي",
          reps: 5,
          load: 20,
          unit: "kg",
        },
      ],
    });
    summary.push(
      "cycle, versioned schedule, idempotent intake, clinical guards, workout",
    );

    stage = "owner isolation (application + RLS)";
    assert.equal(
      await withOwner(B.id, () => getEntity(B.id, "evoSupplements", sup.id)),
      undefined,
    );
    await assert.rejects(() =>
      create(B.id, "evoIntakes", {
        supplementId: sup.id,
        date: "2026-11-03",
        status: "taken",
      }),
    );
    await assert.rejects(() =>
      patch(B.id, "evoCycles", cycle.id, { note: "x" }),
    );
    const rlsCount = await withOwner(B.id, () =>
      query(
        "SELECT count(*)::int AS n FROM mqw_private.records WHERE collection LIKE 'evo%'",
      ),
    );
    assert.equal(
      rlsCount.rows[0].n,
      0,
      "RLS hides other owners' rows even without a user filter",
    );
    summary.push(
      "cross-account read/write/reference denied; raw SQL as B sees 0 of A's rows",
    );

    // Minimal JPEG carrying a synthetic EXIF marker.
    const exif = Buffer.from("Exif\0\0GPS-SYNTHETIC", "latin1");
    const jpeg = Buffer.concat([
      Buffer.from([
        0xff,
        0xd8,
        0xff,
        0xe1,
        (exif.length + 2) >> 8,
        (exif.length + 2) & 255,
      ]),
      exif,
      Buffer.from([
        0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34,
        0xff, 0xd9,
      ]),
    ]);
    const meta = {
      pillar: "skin",
      area: "face",
      date: "2026-11-02",
      caption: "",
    };

    if (phase === "before") {
      stage = "photos disabled before the approved migration";
      const state = await withOwner(A.id, () => getState(A.id));
      assert.equal(state.capabilities?.privatePhotos, false);
      await assert.rejects(
        () => media.savePhoto(A.id, jpeg, meta),
        (e: any) => e.status === 501,
      );
      summary.push(
        "media_blobs absent → privatePhotos=false, upload refused with 501",
      );
    } else {
      stage = "photos after the approved migration";
      const state = await withOwner(A.id, () => getState(A.id));
      assert.equal(state.capabilities?.privatePhotos, true);
      const photo = await media.savePhoto(A.id, jpeg, meta);
      const { bytes } = await media.readPhoto(A.id, photo.id);
      assert.equal(
        bytes.includes(Buffer.from("GPS-SYNTHETIC")),
        false,
        "EXIF stripped",
      );
      await assert.rejects(() => media.readPhoto(B.id, photo.id));
      const blobAsB = await withOwner(B.id, () =>
        query("SELECT count(*)::int AS n FROM mqw_private.media_blobs"),
      );
      assert.equal(blobAsB.rows[0].n, 0, "RLS hides A's photo bytes from B");
      // Forged write: B cannot attach bytes to A's record id.
      await assert.rejects(() =>
        withOwner(B.id, () =>
          transaction(() =>
            query(
              "INSERT INTO mqw_private.media_blobs(user_id,asset_id,bytes) VALUES($1,$2,$3)",
              [A.id, randomUUID(), Buffer.from([1])],
            ),
          ),
        ),
      );
      summary.push(
        "upload/read OK, EXIF stripped, B denied by app and by RLS, forged insert rejected",
      );

      stage = "export streams photo bytes";
      const response = await exportRoute.POST(
        new Request(`${origin}/api/export`, {
          method: "POST",
          headers: {
            origin,
            cookie: `mqw_session=${A.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ password: A.password }),
        }),
      );
      assert.equal(response.status, 200);
      const exported = JSON.parse(await response.text());
      assert.equal(exported.schemaVersion, "mqw-export-2");
      assert.equal(exported.photoFiles.length, 1);
      assert.ok(
        Buffer.from(exported.photoFiles[0].content, "base64").equals(bytes),
      );
      assert.ok(
        exported.state.evoSupplements.length === 1 &&
          exported.state.evoIntakes.length === 1,
      );
      summary.push("export includes MQW 90 records and exact photo bytes");

      stage = "deletion cascades";
      await media.removePhoto(A.id, photo.id);
      let n = (
        await withOwner(A.id, () =>
          query("SELECT count(*)::int AS n FROM mqw_private.media_blobs"),
        )
      ).rows[0].n;
      assert.equal(n, 0, "removing the record removes its blob");
      const second = await media.savePhoto(A.id, jpeg, meta);
      await media.deletePillarData(A.id, PILLAR_DATA.skin);
      n = (
        await withOwner(A.id, () =>
          query("SELECT count(*)::int AS n FROM mqw_private.media_blobs"),
        )
      ).rows[0].n;
      assert.equal(n, 0, "pillar deletion removes blobs");
      assert.equal(
        await withOwner(A.id, () => getEntity(A.id, "evoPhotos", second.id)),
        undefined,
      );
      await media.savePhoto(A.id, jpeg, meta);
      summary.push("photo delete and pillar delete cascade to blobs");
    }
  } finally {
    stage = "password-confirmed account deletion (cleanup)";
    for (const account of accounts) {
      const response = await accountRoute.DELETE(
        new Request(`${origin}/api/account`, {
          method: "DELETE",
          headers: {
            origin,
            cookie: `mqw_session=${account.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ password: account.password }),
        }),
      );
      assert.equal(response.status, 200);
    }
    const left = (
      await query(
        "SELECT (SELECT count(*) FROM mqw_private.users)::int AS users",
      )
    ).rows[0];
    assert.equal(left.users, 0, "no synthetic accounts remain");
    if (phase === "after") {
      const blobs = (
        await query("SELECT count(*)::int AS n FROM mqw_private.media_blobs")
      ).rows[0];
      assert.equal(blobs.n, 0, "account deletion cascades photo bytes");
    }
    summary.push("all synthetic accounts deleted; no rows remain");
    await database.db.close();
  }
  console.log(
    `MQW 90 PostgreSQL smoke (${phase}) passed:\n- ${summary.join("\n- ")}`,
  );
}
main().catch((error) => {
  console.error(`MQW 90 PostgreSQL smoke FAILED at: ${stage}`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
