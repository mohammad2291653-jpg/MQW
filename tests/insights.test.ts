import test from "node:test";
import assert from "node:assert/strict";
import { deriveInsights } from "../src/lib/insights";
import { dateLabel, localDay } from "../src/lib/format";
import type { AppState } from "../src/lib/types";
test("insights use only eligible numerical evidence, never private free text or simulated counts", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  const empty = {
    answers: [],
    reviewEvents: [],
    insightFeedback: [],
    notes: [{ text: "private content must not appear" }],
  } as unknown as AppState;
  assert.deepEqual(deriveInsights(empty, now), []);
  const state = {
    ...empty,
    answers: [
      {
        id: "q1",
        createdAt: "2026-11-18T10:00:00Z",
        gradingSource: "deterministic",
        correct: true,
      },
      {
        id: "q2",
        createdAt: "2026-11-18T10:00:00Z",
        gradingSource: "self_report",
        correct: true,
      },
      {
        id: "q3",
        createdAt: "2026-11-18T10:00:00Z",
        gradingSource: "ungraded",
        correct: null,
      },
    ],
  } as AppState;
  const insights = deriveInsights(state, now);
  assert.equal(insights.length, 1);
  assert.equal(insights[0].denominator, 1);
  assert.deepEqual(insights[0].sources, ["q1"]);
  assert.ok(!JSON.stringify(insights).includes("private content"));
  assert.deepEqual(
    deriveInsights(
      { ...state, insightFeedback: [{ ruleId: "quiz-facts-v1" }] } as AppState,
      now,
    ),
    [],
  );
});
test("date-only deadlines preserve their calendar day across negative and positive timezone offsets", () => {
  assert.equal(
    dateLabel("2026-11-18", "America/New_York", {
      day: "numeric",
      month: "long",
    }),
    dateLabel("2026-11-18", "Pacific/Kiritimati", {
      day: "numeric",
      month: "long",
    }),
  );
  assert.equal(
    localDay("Asia/Hebron", new Date("2026-11-18T23:30:00Z")),
    "2026-11-19",
  );
});
