import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Association, PalaceTrial } from "../src/lib/types";
import { LOCI, trialSummary } from "../src/lib/palace";

const directory = mkdtempSync(join(tmpdir(), "mqw-palace-test-"));
process.env.MQW_DATA_DIR = directory;
const { db, getState, getSecret, transaction } =
  require("../src/lib/server/db") as typeof import("../src/lib/server/db");
const { signUp } =
  require("../src/lib/server/auth") as typeof import("../src/lib/server/auth");
const { palaceAction } =
  require("../src/lib/server/palace") as typeof import("../src/lib/server/palace");
const user = signUp("palace@example.test", "palace-password-123", "Palace");
const other = signUp("other@example.test", "other-password-456", "Other");
function act(body: Record<string, unknown>, userId = user.user.id) {
  return transaction(() => palaceAction(userId, body)) as PalaceTrial;
}
after(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

test("concept trials snapshot links privately and preserve them across edits and retries", () => {
  assert.throws(() => act({ action: "start", kind: "concept" }));
  act({
    action: "save-association",
    locusId: "entrance",
    fact: "Original private fact",
    image: "Original private image",
  });
  const first = act({ action: "start", kind: "concept" });
  assert.equal(act({ action: "start", kind: "concept" }).id, first.id);
  assert.ok(!JSON.stringify(first).includes("Original private"));
  assert.ok(
    JSON.stringify(getSecret(user.user.id, "palaceTrials", first.id)).includes(
      "Original private fact",
    ),
  );
  const edited = act({
    action: "save-association",
    locusId: "entrance",
    fact: "Edited private fact",
    image: "New image",
  }) as unknown as Association;
  assert.equal(edited.version, 2);
  assert.throws(() =>
    act({ action: "reveal", trialId: first.id, locusId: "entrance" }),
  );
  assert.throws(() =>
    act({
      action: "rate",
      trialId: first.id,
      locusId: "entrance",
      rating: "good",
    }),
  );
  const submitted = act({
    action: "submit",
    trialId: first.id,
    locusId: "entrance",
    response: "My honest recall",
  });
  assert.equal(submitted.results[0].modelAnswer, undefined);
  assert.equal(submitted.results[0].rating, undefined);
  const duplicate = act({
    action: "submit",
    trialId: first.id,
    locusId: "entrance",
    response: "Overwriting would lose evidence",
  });
  assert.equal(duplicate.results.length, 1);
  assert.equal(duplicate.results[0].response, "My honest recall");
  const revealed = act({
    action: "reveal",
    trialId: first.id,
    locusId: "entrance",
  });
  assert.equal(revealed.results[0].modelAnswer, "Original private fact");
  const rated = act({
    action: "rate",
    trialId: first.id,
    locusId: "entrance",
    rating: "hard",
  });
  assert.equal(rated.results[0].rating, "hard");
  assert.equal(rated.gradingSource, "self_report");
  const dueAt = new Date(Date.now() + 3 * 86400000).toISOString();
  const finished = act({
    action: "complete",
    trialId: first.id,
    retestAt: dueAt,
  });
  assert.equal(finished.dueAt, dueAt);
  assert.equal(finished.status, "completed");
  assert.equal(act({ action: "complete", trialId: first.id }).id, first.id);
  assert.equal(getState(user.user.id).reviews.length, 1);
  const later = act({ action: "start", kind: "concept" });
  assert.notEqual(later.id, first.id);
  act({
    action: "submit",
    trialId: later.id,
    locusId: "entrance",
    response: "Edited private fact",
  });
  assert.equal(
    act({ action: "reveal", trialId: later.id, locusId: "entrance" }).results[0]
      .modelAnswer,
    "Edited private fact",
  );
  act({
    action: "rate",
    trialId: later.id,
    locusId: "entrance",
    rating: "good",
  });
  act({ action: "complete", trialId: later.id });
  const state = getState(user.user.id);
  assert.equal(state.reviews.length, 1);
  assert.equal(
    state.reviewEvents.filter((event) => event.kind === "attempt").length,
    1,
  );
  assert.equal(
    state.palaceTrials.filter((trial) => trial.status === "completed").length,
    2,
  );
});

test("route answers remain secret until submitted, and skipped locations are not scored", () => {
  const trial = act({ action: "start", kind: "route" });
  assert.deepEqual(trial.locusIds, [
    "position-1",
    "position-2",
    "position-3",
    "position-4",
    "position-5",
  ]);
  assert.ok(!JSON.stringify(trial).includes("entrance"));
  assert.throws(() => act({ action: "complete", trialId: trial.id }));
  assert.throws(() =>
    act({
      action: "submit",
      trialId: trial.id,
      locusId: "position-2",
      response: "hallway",
    }),
  );
  const correct = act({
    action: "submit",
    trialId: trial.id,
    locusId: "position-1",
    response: "entrance",
  });
  assert.equal(correct.results[0].rating, "good");
  assert.equal(correct.results[0].modelAnswer, "المدخل");
  assert.equal(correct.gradingSource, "deterministic");
  const skipped = act({
    action: "skip",
    trialId: trial.id,
    locusId: "position-2",
  });
  assert.equal(skipped.results[1].skipped, true);
  assert.equal(skipped.results[1].rating, undefined);
  act({
    action: "submit",
    trialId: trial.id,
    locusId: "position-3",
    response: "library",
  });
  act({ action: "skip", trialId: trial.id, locusId: "position-4" });
  const all = act({
    action: "submit",
    trialId: trial.id,
    locusId: "position-5",
    response: "library",
  });
  assert.deepEqual(trialSummary(all), {
    answered: 3,
    recalled: 2,
    partial: 0,
    again: 1,
    skipped: 2,
  });
  assert.throws(() =>
    act({
      action: "complete",
      trialId: trial.id,
      retestAt: "2020-01-01T00:00:00Z",
    }),
  );
  assert.equal(
    getState(user.user.id).palaceTrials.find((item) => item.id === trial.id)
      ?.status,
    "in_progress",
  );
  act({ action: "complete", trialId: trial.id });
});

test("another account cannot access trials or reveal private snapshots", () => {
  const trial = act({ action: "start", kind: "route" });
  assert.throws(() =>
    act({ action: "resume", trialId: trial.id }, other.user.id),
  );
  assert.throws(() =>
    act(
      {
        action: "submit",
        trialId: trial.id,
        locusId: "position-1",
        response: "entrance",
      },
      other.user.id,
    ),
  );
  assert.throws(() => getSecret(other.user.id, "palaceTrials", trial.id));
  assert.deepEqual(getState(other.user.id).palaceTrials, []);
  assert.deepEqual(getState(other.user.id).associations, []);
});

test("fixed palace contains five distinct loci and editing never accepts an unknown location", () => {
  assert.equal(LOCI.length, 5);
  assert.equal(new Set(LOCI.map((locus) => locus.id)).size, 5);
  assert.throws(() =>
    act({
      action: "save-association",
      locusId: "secret-room",
      fact: "Fact",
      image: "Image",
    }),
  );
  assert.throws(() =>
    act({
      action: "save-association",
      locusId: "kitchen",
      fact: " ",
      image: "Image",
    }),
  );
});
