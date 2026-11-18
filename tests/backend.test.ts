import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "mqw-test-"));
process.env.MQW_DATA_DIR = dir;
const {
  db,
  getState,
  getEntity,
  getSecret,
  listEntities,
  transaction,
  ApiError,
  updateEntity,
} = require("../src/lib/server/db") as typeof import("../src/lib/server/db");
const { signUp, signIn, getUserByToken, changePassword } =
  require("../src/lib/server/auth") as typeof import("../src/lib/server/auth");
const { createRecord, patchRecord, patchPreferences } =
  require("../src/lib/server/records") as typeof import("../src/lib/server/records");
const { learningAction, reviewsAction } =
  require("../src/lib/server/learning") as typeof import("../src/lib/server/learning");
const { checkOrigin } =
  require("../src/lib/server/http") as typeof import("../src/lib/server/http");
const a = signUp("a@example.test", "private-password-123", "A");
const b = signUp("b@example.test", "private-password-456", "B");
const act = (body: Record<string, unknown>) =>
  transaction(() => learningAction(a.user.id, body)) as any;
const rev = (body: Record<string, unknown>) =>
  transaction(() => reviewsAction(a.user.id, body)) as any;
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
test("real password hashes and session tokens isolate accounts", () => {
  assert.equal(
    signIn("a@example.test", "private-password-123").user.id,
    a.user.id,
  );
  assert.throws(() => signIn("a@example.test", "wrong-password"));
  assert.equal(getUserByToken(a.token)?.id, a.user.id);
  assert.equal(getUserByToken("fake"), null);
  const rows = db.prepare("SELECT password_hash FROM users").all() as {
    password_hash: string;
  }[];
  assert.ok(
    rows.every((row) => !row.password_hash.includes("private-password")),
  );
  const sessions = db.prepare("SELECT token_hash FROM sessions").all() as {
    token_hash: string;
  }[];
  assert.ok(
    sessions.every(
      (row) => row.token_hash !== a.token && row.token_hash !== b.token,
    ),
  );
});
test("all records are private and references cannot target another account", () => {
  const note = createRecord(a.user.id, "notes", {
    text: "Private diary",
    journal: true,
  });
  assert.equal(getEntity(b.user.id, "notes", note.id), undefined);
  assert.throws(() =>
    patchRecord(b.user.id, "notes", note.id, { text: "intrusion" }),
  );
  assert.throws(() =>
    createRecord(b.user.id, "tasks", { title: "link attack", noteId: note.id }),
  );
  assert.throws(() =>
    createRecord(a.user.id, "answers", { response: "forged" }),
  );
  assert.deepEqual(getState(b.user.id).notes, []);
  assert.equal(getState(a.user.id).tasks.length, 0);
});
test("cross-site mutations fail and timezone settings validate IANA names", () => {
  assert.throws(() =>
    checkOrigin(
      new Request("http://localhost/api/state", {
        headers: { origin: "https://attacker.test" },
      }),
    ),
  );
  checkOrigin(
    new Request("http://localhost/api/state", {
      headers: { origin: "http://localhost" },
    }),
  );
  assert.throws(() => patchPreferences(a.user.id, { timezone: "made-up" }));
  assert.equal(
    patchPreferences(a.user.id, { timezone: "Asia/Hebron" }).timezone,
    "Asia/Hebron",
  );
});
test("complete real lesson loop persists retries, self-report and review without answer leakage", () => {
  const { attempt } = act({
    action: "start",
    lessonSlug: "familiarity-is-not-recall",
  });
  assert.equal(
    act({ action: "start", lessonSlug: "familiarity-is-not-recall" }).attempt
      .id,
    attempt.id,
  );
  assert.throws(() => act({ action: "complete", attemptId: attempt.id }));
  const body = {
    action: "submit",
    attemptId: attempt.id,
    questionId: "recall",
    response: "DNA in the nucleus",
    submissionId: "l1-first",
  };
  const first = act(body).answer;
  assert.equal(act(body).answer.id, first.id);
  assert.equal(listEntities(a.user.id, "answers").length, 1);
  assert.equal(first.correct, null);
  assert.ok(first.modelAnswer);
  act({
    action: "self-grade",
    answerId: first.id,
    rating: "good",
    submissionId: "grade-first",
  });
  const incorrect = act({
    action: "submit",
    attemptId: attempt.id,
    questionId: "recognize",
    response: "reread",
    submissionId: "wrong",
  }).answer;
  assert.equal(incorrect.correct, false);
  assert.ok(incorrect.feedback);
  assert.throws(() =>
    act({
      action: "submit",
      attemptId: attempt.id,
      questionId: "recognize",
      response: "close",
      submissionId: "retry",
    }),
  );
  const result = act({ action: "complete", attemptId: attempt.id });
  assert.equal(result.attempt.status, "completed");
  assert.equal(result.review.algorithm, "fixed-v1");
  assert.ok(Date.parse(result.review.dueAt) > Date.now());
  assert.equal((result.review as any).modelAnswer, undefined);
  assert.ok(
    getSecret<{ modelAnswer: string }>(a.user.id, "reviews", result.review.id)
      .modelAnswer,
  );
  const state = getState(a.user.id);
  assert.equal(state.answers.length, 2);
  assert.equal(state.reviews.length, 1);
  assert.throws(() =>
    transaction(() =>
      learningAction(b.user.id, {
        action: "submit",
        attemptId: attempt.id,
        questionId: "recognize",
        response: "close",
        submissionId: "steal",
      }),
    ),
  );
  const r = rev({
    action: "submit",
    cardId: result.review.id,
    response: "retrieval without source",
    submissionId: "review-first",
  });
  assert.ok(r.modelAnswer);
  const rated = rev({ action: "rate", eventId: r.event.id, rating: "good" });
  assert.ok(Date.parse(rated.review.dueAt) > Date.now());
  assert.equal(
    rev({ action: "rate", eventId: r.event.id, rating: "good" }).review.dueAt,
    rated.review.dueAt,
  );
  rev({
    action: "reschedule",
    cardId: result.review.id,
    dueAt: "2030-11-18T12:00:00Z",
  });
  assert.equal(
    getState(a.user.id).reviewEvents.filter((e) => e.kind === "reschedule")
      .length,
    1,
  );
  assert.equal(
    getState(a.user.id).reviewEvents.filter((e) => e.kind === "attempt").length,
    1,
  );
  const retry = act({
    action: "start",
    lessonSlug: "familiarity-is-not-recall",
  }).attempt;
  assert.notEqual(retry.id, attempt.id);
  const recall = act({
    action: "submit",
    attemptId: retry.id,
    questionId: "recall",
    response: "The nucleus stores most DNA",
    submissionId: "whole-retry-recall",
  }).answer;
  act({
    action: "self-grade",
    answerId: recall.id,
    rating: "good",
    submissionId: "whole-retry-grade",
  });
  assert.equal(
    act({
      action: "submit",
      attemptId: retry.id,
      questionId: "recognize",
      response: "close",
      submissionId: "whole-retry-choice",
    }).answer.correct,
    true,
  );
  act({ action: "complete", attemptId: retry.id });
  assert.equal(
    getState(a.user.id).answers.find((x) => x.id === incorrect.id)?.correct,
    false,
  );
  assert.equal(getState(a.user.id).lessonAttempts.length, 2);
});
test("password change invalidates old sessions", () => {
  const token = changePassword(
    b.user.id,
    "private-password-456",
    "new-private-password",
  );
  assert.equal(getUserByToken(b.token), null);
  assert.equal(getUserByToken(token)?.id, b.user.id);
});
test("HTTP audio/export/delete require owner session and fresh password", async () => {
  const c = signUp("c@example.test", "private-password-789", "C");
  const cookie = `mqw_session=${c.token}`;
  const origin = "http://localhost";
  const voice =
    require("../src/app/api/voice/route") as typeof import("../src/app/api/voice/route");
  const assetRoute =
    require("../src/app/api/voice/[id]/route") as typeof import("../src/app/api/voice/[id]/route");
  const exportRoute =
    require("../src/app/api/export/route") as typeof import("../src/app/api/export/route");
  const accountRoute =
    require("../src/app/api/account/route") as typeof import("../src/app/api/account/route");
  const form = new FormData();
  form.set(
    "file",
    new File([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], "recording.webm", {
      type: "audio/webm",
    }),
  );
  form.set("title", "My private audio");
  const upload = await voice.POST(
    new Request(`${origin}/api/voice`, {
      method: "POST",
      headers: { origin, cookie },
      body: form,
    }),
  );
  assert.equal(upload.status, 201);
  const asset = (await upload.json()).data;
  const context = { params: Promise.resolve({ id: asset.id }) };
  const denied = await assetRoute.GET(
    new Request(`${origin}/api/voice/${asset.id}`, {
      headers: { cookie: `mqw_session=${a.token}` },
    }),
    context,
  );
  assert.equal(denied.status, 404);
  const download = await assetRoute.GET(
    new Request(`${origin}/api/voice/${asset.id}`, { headers: { cookie } }),
    context,
  );
  assert.equal(download.status, 200);
  assert.equal((await download.arrayBuffer()).byteLength, 4);
  const badExport = await exportRoute.POST(
    new Request(`${origin}/api/export`, {
      method: "POST",
      headers: { origin, cookie },
      body: JSON.stringify({ password: "incorrect" }),
    }),
  );
  assert.equal(badExport.status, 401);
  const exported = await exportRoute.POST(
    new Request(`${origin}/api/export`, {
      method: "POST",
      headers: { origin, cookie },
      body: JSON.stringify({ password: "private-password-789" }),
    }),
  );
  assert.equal(exported.status, 200);
  const payload = await exported.json();
  assert.equal(payload.user.id, c.user.id);
  assert.equal(payload.voiceFiles[0].content, "GkXfow==");
  assert.equal(payload.state.notes.length, 0);
  const badDelete = await accountRoute.DELETE(
    new Request(`${origin}/api/account`, {
      method: "DELETE",
      headers: { origin, cookie },
      body: JSON.stringify({ password: "incorrect" }),
    }),
  );
  assert.equal(badDelete.status, 401);
  assert.equal(getUserByToken(c.token)?.id, c.user.id);
  const deleted = await accountRoute.DELETE(
    new Request(`${origin}/api/account`, {
      method: "DELETE",
      headers: { origin, cookie },
      body: JSON.stringify({ password: "private-password-789" }),
    }),
  );
  assert.equal(deleted.status, 200);
  assert.equal(getUserByToken(c.token), null);
  assert.equal(listEntities(c.user.id, "voiceAssets").length, 0);
  assert.equal(
    db.prepare("SELECT id FROM users WHERE id=?").get(c.user.id),
    undefined,
  );
});

test("interrupted drafts survive reload and progression cannot skip unanswered questions", () => {
  const { attempt } = act({
    action: "start",
    lessonSlug: "familiarity-is-not-recall",
  });
  assert.throws(() =>
    act({ action: "progress", attemptId: attempt.id, step: 3 }),
  );
  act({ action: "progress", attemptId: attempt.id, step: 1 });
  act({
    action: "progress",
    attemptId: attempt.id,
    step: 1,
    draftQuestionId: "recall",
    draftResponse: "A saved unfinished answer",
  });
  assert.equal(
    getState(a.user.id).lessonAttempts.find((x) => x.id === attempt.id)
      ?.draftResponse,
    "A saved unfinished answer",
  );
  assert.throws(() =>
    act({ action: "progress", attemptId: attempt.id, step: 2 }),
  );
  const body = {
    action: "submit",
    attemptId: attempt.id,
    questionId: "recall",
    response: "Genetic material",
    submissionId: "draft-submit",
  };
  const first = act(body).answer;
  assert.equal(
    act({ ...body, submissionId: "new-id-after-reload" }).answer.id,
    first.id,
  );
  assert.equal(
    getState(a.user.id).lessonAttempts.find((x) => x.id === attempt.id)
      ?.draftResponse,
    null,
  );
  assert.throws(() =>
    act({ action: "progress", attemptId: attempt.id, step: 2 }),
  );
  act({
    action: "self-grade",
    answerId: first.id,
    rating: "good",
    submissionId: "draft-rating",
  });
  assert.equal(
    act({ action: "progress", attemptId: attempt.id, step: 2 }).attempt.step,
    2,
  );
  updateEntity(a.user.id, "lessonAttempts", attempt.id, {
    contentVersion: "0.0.0",
  });
  assert.throws(
    () =>
      act({
        action: "submit",
        attemptId: attempt.id,
        questionId: "recognize",
        response: "close",
        submissionId: "legacy-answer",
      }),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
});

test("same-origin guard accepts browser Host behind wildcard bind and refuses forged forwarded origin", () => {
  checkOrigin(
    new Request("http://0.0.0.0:3000/api/auth", {
      headers: { host: "localhost:3000", origin: "http://localhost:3000" },
    }),
  );
  assert.throws(() =>
    checkOrigin(
      new Request("http://0.0.0.0:3000/api/auth", {
        headers: {
          host: "localhost:3000",
          origin: "https://evil.test",
          "x-forwarded-host": "evil.test",
        },
      }),
    ),
  );
  assert.throws(() =>
    checkOrigin(
      new Request("http://0.0.0.0:3000/api/auth", {
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "sec-fetch-site": "cross-site",
        },
      }),
    ),
  );
});

test("calibration refuses a prediction entered after scored quiz answers", () => {
  const { attempt } = act({
    action: "start",
    lessonSlug: "metacognitive-calibration",
  });
  act({
    action: "submit",
    attemptId: attempt.id,
    questionId: "organelle",
    response: "mitochondria",
    submissionId: "calibration-scored-first",
  });
  assert.throws(
    () =>
      act({
        action: "submit",
        attemptId: attempt.id,
        questionId: "prediction",
        response: "2",
        submissionId: "calibration-hindsight",
      }),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
});

test("production owner setup requires the one-use secret and closes after registration", async () => {
  const keys = [
    "NODE_ENV",
    "MQW_OWNER_EMAIL",
    "MQW_SETUP_TOKEN_HASH",
    "MQW_APP_ORIGIN",
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const { registrationMode } =
    require("../src/lib/server/auth") as typeof import("../src/lib/server/auth");
  const route =
    require("../src/app/api/auth/route") as typeof import("../src/app/api/auth/route");
  const setupToken = "synthetic-test-setup-secret-only";
  try {
    Object.assign(process.env, {
      NODE_ENV: "production",
      MQW_OWNER_EMAIL: "production-owner@example.test",
    });
    delete process.env.MQW_APP_ORIGIN;
    delete process.env.MQW_SETUP_TOKEN_HASH;
    assert.equal(registrationMode(), "closed");
    assert.throws(() =>
      signUp(
        "production-owner@example.test",
        "owner-private-password",
        "Owner",
      ),
    );
    process.env.MQW_SETUP_TOKEN_HASH = createHash("sha256")
      .update(setupToken)
      .digest("hex");
    assert.equal(registrationMode(), "invite");
    const capabilities = await (
      await route.GET(new Request("http://localhost/api/auth"))
    ).json();
    assert.equal(capabilities.data.capabilities.registration, "invite");
    assert.equal(JSON.stringify(capabilities).includes(setupToken), false);
    assert.equal(
      JSON.stringify(capabilities).includes(process.env.MQW_SETUP_TOKEN_HASH),
      false,
    );
    const post = (body: Record<string, unknown>) =>
      route.POST(
        new Request("http://localhost/api/auth", {
          method: "POST",
          headers: { origin: "http://localhost" },
          body: JSON.stringify(body),
        }),
      );
    const values = {
      action: "sign-up",
      email: "production-owner@example.test",
      password: "owner-private-password",
      name: "Owner",
    };
    assert.equal((await post(values)).status, 403);
    assert.equal(
      (await post({ ...values, setupToken: "tampered" })).status,
      403,
    );
    assert.throws(() =>
      signUp(
        "another@example.test",
        "owner-private-password",
        "Other",
        setupToken,
      ),
    );
    const accepted = await post({ ...values, setupToken });
    assert.equal(accepted.status, 200);
    assert.ok(accepted.headers.get("set-cookie")?.includes("; Secure"));
    assert.equal(registrationMode(), "closed");
    assert.ok((await post({ ...values, setupToken })).status >= 400);
    const login = await post({
      action: "sign-in",
      email: values.email,
      password: values.password,
    });
    assert.equal(login.status, 200);
    assert.equal(
      (await (await route.GET(new Request("http://localhost/api/auth"))).json())
        .data.capabilities.registration,
      "closed",
    );
    const owner = signIn(values.email, values.password).user;
    db.prepare("DELETE FROM users WHERE id=?").run(owner.id);
    assert.equal(
      registrationMode(),
      "closed",
      "deleting the owner cannot reactivate a consumed setup link",
    );
    assert.throws(() =>
      signUp(values.email, values.password, "Owner", setupToken),
    );
    process.env.MQW_SETUP_TOKEN_HASH = createHash("sha256")
      .update("rotated-synthetic-setup-secret")
      .digest("hex");
    assert.equal(
      registrationMode(),
      "invite",
      "a deliberately rotated setup link can initialize a replacement owner",
    );
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else Object.assign(process.env, { [key]: previous[key] });
    }
  }
});

test("configured HTTPS origin remains authoritative behind an HTTP reverse proxy", () => {
  const previous = process.env.MQW_APP_ORIGIN;
  try {
    process.env.MQW_APP_ORIGIN = "https://mqw.example.test";
    checkOrigin(
      new Request("http://0.0.0.0:10000/api/preferences", {
        headers: {
          host: "internal:10000",
          origin: "https://mqw.example.test",
          "x-forwarded-proto": "http",
          "x-forwarded-host": "untrusted.example.test",
        },
      }),
    );
    assert.throws(() =>
      checkOrigin(
        new Request("http://0.0.0.0:10000/api/preferences", {
          headers: {
            host: "internal:10000",
            origin: "http://mqw.example.test",
            "x-forwarded-proto": "https",
          },
        }),
      ),
    );
    assert.throws(() =>
      checkOrigin(
        new Request("http://0.0.0.0:10000/api/preferences", {
          headers: {
            host: "internal:10000",
            origin: "https://untrusted.example.test",
            "x-forwarded-host": "untrusted.example.test",
          },
        }),
      ),
    );
  } finally {
    if (previous === undefined) delete process.env.MQW_APP_ORIGIN;
    else process.env.MQW_APP_ORIGIN = previous;
  }
});
