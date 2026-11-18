/**
 * OPT IN ONLY. Never picked up by `npm test` or Playwright.
 * Run: MQW_PG_SMOKE=1 MQW_STORAGE_BACKEND=postgres MQW_DATABASE_URL=... \
 *      MQW_PG_SMOKE_TARGET='localhost:PORT/mqw_smoke' npx tsx tests/postgres-runtime.smoke.ts
 * The caller provisions an explicitly selected disposable target and verified TLS CA.
 * This script never creates schemas, changes roles, truncates tables, or visits a cloud account.
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type {
  Answer,
  LessonAttempt,
  PalaceTrial,
  ReviewCard,
  ReviewEvent,
  VoiceAsset,
} from "../src/lib/types";

let currentStage = "explicit opt-in and disposable-target validation";

async function main() {
  if (process.env.MQW_PG_SMOKE !== "1") {
    console.log(
      "PostgreSQL runtime smoke skipped: explicit MQW_PG_SMOKE=1 required.",
    );
    return;
  }
  assert.equal(
    process.env.MQW_STORAGE_BACKEND,
    "postgres",
    "Explicit postgres backend required.",
  );
  assert.ok(
    process.env.MQW_DATABASE_URL,
    "Explicit disposable PostgreSQL URL required.",
  );
  assert.ok(
    !process.env.MQW_OWNER_EMAIL && !process.env.MQW_SETUP_TOKEN_HASH,
    "Owner configuration is forbidden in synthetic smoke tests.",
  );
  assert.notEqual(
    process.env.NODE_ENV,
    "production",
    "Smoke tests cannot run in production mode.",
  );
  assert.notEqual(
    process.env.NODE_TLS_REJECT_UNAUTHORIZED,
    "0",
    "TLS certificate verification must remain enabled.",
  );
  const target = new URL(process.env.MQW_DATABASE_URL!);
  assert.ok(
    ["postgres:", "postgresql:"].includes(target.protocol),
    "Invalid database protocol.",
  );
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname),
    "This smoke script only accepts a local loopback PostgreSQL target.",
  );
  assert.equal(
    target.pathname,
    "/mqw_smoke",
    "Only the dedicated disposable mqw_smoke database is permitted.",
  );
  assert.equal(
    process.env.MQW_PG_SMOKE_TARGET,
    `${target.hostname}:${target.port || "5432"}${target.pathname}`,
    "Explicit host:port/database target confirmation required.",
  );
  assert.ok(
    !["disable", "no-verify"].includes(
      target.searchParams.get("sslmode") || "",
    ),
    "Verified TLS required.",
  );

  const database = await import("../src/lib/server/db");
  const auth = await import("../src/lib/server/auth");
  const { learningAction, reviewsAction } =
    await import("../src/lib/server/learning");
  const { palaceAction } = await import("../src/lib/server/palace");
  const { LOCI } = await import("../src/lib/palace");
  const voiceRoute = await import("../src/app/api/voice/route");
  const voiceAssetRoute = await import("../src/app/api/voice/[id]/route");
  const exportRoute = await import("../src/app/api/export/route");
  const accountRoute = await import("../src/app/api/account/route");
  const {
    db,
    query,
    withOwner,
    transaction,
    getState,
    getEntity,
    getSecret,
    createEntity,
  } = database;
  const accounts: {
    user: { id: string; email: string };
    token: string;
    password: string;
  }[] = [];
  const origin = process.env.MQW_APP_ORIGIN || "http://localhost";
  const request = (
    path: string,
    token: string,
    body: unknown,
    method = "POST",
  ) =>
    new Request(`${origin}${path}`, {
      method,
      headers: {
        origin,
        cookie: `mqw_session=${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const summary: string[] = [];
  try {
    currentStage = "verified TLS and restricted runtime role";
    const role = (
      await query(
        "SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    assert.equal(role.name, "mqw_app");
    assert.equal(role.rolsuper, false);
    assert.equal(role.rolbypassrls, false);
    const tls = (
      await query("SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()")
    ).rows[0];
    assert.equal(
      tls?.ssl,
      true,
      "Real PostgreSQL wire connection must use TLS.",
    );
    summary.push("verified TLS; restricted mqw_app runtime role");
    for (let index = 0; index < 2; index++) {
      const password = randomBytes(24).toString("hex");
      const account = await auth.signUp(
        `mqw-smoke-${randomUUID()}@example.test`,
        password,
        "Synthetic PostgreSQL smoke",
      );
      accounts.push({ ...account, password });
      assert.equal(
        (await auth.signIn(account.user.email, password)).user.id,
        account.user.id,
      );
    }
    const [a, b] = accounts;
    const act = (payload: Record<string, unknown>) =>
      transaction(() => learningAction(a.user.id, payload)) as Promise<{
        attempt: LessonAttempt;
        answer: Answer;
        review: ReviewCard;
      }>;
    const review = (payload: Record<string, unknown>) =>
      transaction(() => reviewsAction(a.user.id, payload)) as Promise<{
        event: ReviewEvent;
        review: ReviewCard;
        modelAnswer: string;
      }>;
    const palace = (payload: Record<string, unknown>) =>
      transaction(() =>
        palaceAction(a.user.id, payload),
      ) as Promise<PalaceTrial>;

    currentStage =
      "concurrent lesson start, durable submissions, review and RLS isolation";
    const starts = await Promise.all([
      act({ action: "start", lessonSlug: "familiarity-is-not-recall" }),
      act({ action: "start", lessonSlug: "familiarity-is-not-recall" }),
    ]);
    const attempt = starts[0].attempt;
    assert.equal(starts[1].attempt.id, attempt.id);
    const submission = {
      action: "submit",
      attemptId: attempt.id,
      questionId: "recall",
      response: "Synthetic recall: genetic material",
      submissionId: randomUUID(),
    };
    const submissions = await Promise.all([act(submission), act(submission)]);
    const first = submissions[0].answer;
    assert.equal(submissions[1].answer.id, first.id);
    assert.equal(first.correct, null);
    await act({
      action: "self-grade",
      answerId: first.id,
      rating: "good",
      submissionId: randomUUID(),
    });
    const closed = (
      await act({
        action: "submit",
        attemptId: attempt.id,
        questionId: "recognize",
        response: "close",
        submissionId: randomUUID(),
      })
    ).answer;
    assert.equal(closed.correct, true);
    const completed = await act({ action: "complete", attemptId: attempt.id });
    assert.equal(completed.attempt.status, "completed");
    assert.equal(
      (completed.review as unknown as { modelAnswer?: string }).modelAnswer,
      undefined,
    );
    assert.ok(
      (
        await getSecret<{ modelAnswer: string }>(
          a.user.id,
          "reviews",
          completed.review.id,
        )
      ).modelAnswer,
    );
    const reviewed = await review({
      action: "submit",
      cardId: completed.review.id,
      response: "Synthetic recall without source",
      submissionId: randomUUID(),
    });
    await review({
      action: "rate",
      eventId: reviewed.event.id,
      rating: "good",
    });
    await review({
      action: "reschedule",
      cardId: completed.review.id,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
    });
    assert.equal((await getState(a.user.id)).answers.length, 2);
    assert.equal(
      await getEntity(b.user.id, "lessonAttempts", attempt.id),
      undefined,
    );
    assert.equal((await getState(b.user.id)).answers.length, 0);
    await assert.rejects(() =>
      getSecret(b.user.id, "reviews", completed.review.id),
    );
    assert.equal(
      Number(
        (await query("SELECT COUNT(*) AS n FROM mqw_private.records")).rows[0]
          .n,
      ),
      0,
      "Owner context must reset before unscoped queries.",
    );
    summary.push(
      "durable lesson, deduplication, review, secret boundaries and account isolation",
    );

    currentStage = "five-locus palace and concealed answer snapshots";
    for (const [index, locus] of LOCI.entries())
      await palace({
        action: "save-association",
        locusId: locus.id,
        fact: `Synthetic smoke fact ${index}`,
        image: `Synthetic smoke image ${index}`,
      });
    const trial = await palace({ action: "start", kind: "concept" });
    assert.ok(
      !JSON.stringify(trial).includes("Synthetic smoke fact"),
      "Blind trial must omit answer snapshots.",
    );
    for (const [index, locus] of LOCI.entries()) {
      const submitted = await palace({
        action: "submit",
        trialId: trial.id,
        locusId: locus.id,
        response: `Synthetic response ${index}`,
      });
      assert.equal(submitted.results[index].modelAnswer, undefined);
      const revealed = await palace({
        action: "reveal",
        trialId: trial.id,
        locusId: locus.id,
      });
      assert.equal(
        revealed.results[index].modelAnswer,
        `Synthetic smoke fact ${index}`,
      );
      await palace({
        action: "rate",
        trialId: trial.id,
        locusId: locus.id,
        rating: "good",
      });
    }
    assert.equal(
      (await palace({ action: "complete", trialId: trial.id })).status,
      "completed",
    );
    assert.equal(
      await getEntity(b.user.id, "palaceTrials", trial.id),
      undefined,
    );
    summary.push(
      "five-locus persisted palace, concealed answers, ratings and later retest",
    );

    // Synthetic binary fixture checks bytea and streaming/export chunk boundaries, not media decoding.
    currentStage =
      "PostgreSQL audio bytes, account isolation and streamed export";
    const bytes = randomBytes(1024 * 1024 + 5);
    const form = new FormData();
    form.set(
      "file",
      new File([new Uint8Array(bytes)], "synthetic.webm", {
        type: "audio/webm",
      }),
    );
    form.set("title", "Synthetic audio fixture");
    const uploaded = await voiceRoute.POST(
      new Request(`${origin}/api/voice`, {
        method: "POST",
        headers: { origin, cookie: `mqw_session=${a.token}` },
        body: form,
      }),
    );
    assert.equal(
      uploaded.status,
      201,
      "PostgreSQL audio upload must commit metadata and bytes.",
    );
    const asset = (await uploaded.json()).data as VoiceAsset;
    const voiceContext = { params: Promise.resolve({ id: asset.id }) };
    const denied = await voiceAssetRoute.GET(
      new Request(`${origin}/api/voice/${asset.id}`, {
        headers: { cookie: `mqw_session=${b.token}` },
      }),
      voiceContext,
    );
    assert.equal(denied.status, 404);
    const playback = await voiceAssetRoute.GET(
      new Request(`${origin}/api/voice/${asset.id}`, {
        headers: { cookie: `mqw_session=${a.token}` },
      }),
      voiceContext,
    );
    assert.equal(playback.status, 200);
    assert.ok(Buffer.from(await playback.arrayBuffer()).equals(bytes));
    const exported = await exportRoute.POST(
      request("/api/export", a.token, { password: a.password }),
    );
    assert.equal(exported.status, 200);
    const archive = await exported.json();
    assert.equal(archive.user.id, a.user.id);
    assert.equal(archive.state.lessonAttempts[0].status, "completed");
    assert.equal(archive.state.palaceTrials[0].status, "completed");
    assert.ok(
      Buffer.from(archive.voiceFiles[0].content, "base64").equals(bytes),
    );
    summary.push(
      "private PostgreSQL bytea audio, cross-account denial and streamed export",
    );

    currentStage = "async rollback and account/audio cascade deletion";
    const before = (await getState(a.user.id)).notes.length;
    await assert.rejects(() =>
      transaction(async () => {
        await createEntity(a.user.id, "notes", { text: "must roll back" });
        throw new Error("synthetic rollback");
      }),
    );
    assert.equal((await getState(a.user.id)).notes.length, before);
    const wrongPassword = await accountRoute.DELETE(
      request(
        "/api/account",
        a.token,
        { password: "wrong-synthetic-password" },
        "DELETE",
      ),
    );
    assert.equal(wrongPassword.status, 401);
    const deleted = await accountRoute.DELETE(
      request("/api/account", a.token, { password: a.password }, "DELETE"),
    );
    assert.equal(deleted.status, 200);
    assert.equal((await deleted.json()).data.filesDeletionPending, false);
    assert.equal(await auth.getUserByToken(a.token), null);
    assert.equal(
      await db.prepare("SELECT id FROM users WHERE id=?").get(a.user.id),
      undefined,
    );
    await withOwner(a.user.id, async () => {
      for (const table of ["records", "idempotency", "voice_blobs"])
        assert.equal(
          Number(
            (
              await query(
                `SELECT COUNT(*) AS n FROM mqw_private.${table} WHERE user_id=$1`,
                [a.user.id],
              )
            ).rows[0].n,
          ),
          0,
        );
    });
    summary.push(
      "async rollback; password-protected account deletion cascades evidence, sessions and audio",
    );
  } finally {
    try {
      for (const account of accounts) {
        // A token can expire or be invalidated while the synthetic account still exists.
        if (
          !(await db
            .prepare("SELECT id FROM users WHERE id=?")
            .get(account.user.id))
        )
          continue;
        const token = (await auth.getUserByToken(account.token))
          ? account.token
          : (await auth.signIn(account.user.email, account.password)).token;
        const deleted = await accountRoute.DELETE(
          request(
            "/api/account",
            token,
            { password: account.password },
            "DELETE",
          ),
        );
        if (deleted.status !== 200)
          throw new Error("Synthetic account cleanup failed.");
      }
    } finally {
      await db.close();
    }
  }
  console.log(JSON.stringify({ status: "passed", checks: summary }, null, 2));
}
main().catch((error) => {
  console.error(
    JSON.stringify({
      status: "failed",
      stage: currentStage,
      errorType: error instanceof Error ? error.name : "unknown",
      code: typeof error?.code === "string" ? error.code : undefined,
      message:
        "PostgreSQL runtime smoke failed; credentials and payloads are intentionally omitted.",
    }),
  );
  process.exitCode = 1;
});
