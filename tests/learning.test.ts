import test from "node:test";
import assert from "node:assert/strict";
import { LESSONS, getLesson, getRequiredQuestionIds } from "../src/lib/lessons";
import {
  gradeQuestion,
  getLessonVersion,
  getReviewQuestion,
} from "../src/lib/server/lesson-keys";

test("four lessons have stable versions, reachable required questions and review targets", () => {
  assert.equal(LESSONS.length, 4);
  for (const lesson of LESSONS) {
    assert.equal(getLessonVersion(lesson.slug), lesson.version);
    assert.equal(
      new Set(lesson.steps.map((step) => step.id)).size,
      lesson.steps.length,
    );
    const questions = lesson.steps.flatMap((step) =>
      "questionId" in step ? [step.questionId] : [],
    );
    for (const id of getRequiredQuestionIds(lesson.slug))
      assert.ok(questions.includes(id));
    const review = getReviewQuestion(lesson.slug);
    assert.ok(review?.modelAnswer.length);
    assert.ok(review?.prompt.length);
    // Review prompts are distinct from initial questions: do not claim paired-item recall.
    assert.ok(!questions.includes(review!.questionId));
  }
  assert.equal(getLesson("missing"), undefined);
});

test("public lesson definitions do not contain answer keys or grading functions", () => {
  function inspect(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      assert.ok(
        ![
          "answer",
          "correct",
          "correctAnswer",
          "modelAnswer",
          "feedback",
          "rubric",
        ].includes(key),
        `private property ${key}`,
      );
      inspect(item);
    }
  }
  inspect(LESSONS);
});

test("closed-choice responses are evaluated by explicit answer keys", () => {
  const correct = gradeQuestion(
    "familiarity-is-not-recall",
    "recognize",
    "close",
  );
  const incorrect = gradeQuestion(
    "familiarity-is-not-recall",
    "recognize",
    "reread",
  );
  assert.equal(correct.correct, true);
  assert.equal(incorrect.correct, false);
  assert.equal(correct.gradingSource, "deterministic");
  assert.ok(incorrect.feedback.includes("الألفة"));
  assert.ok(incorrect.modelAnswer);
  assert.throws(() =>
    gradeQuestion("familiarity-is-not-recall", "recognize", "invented"),
  );
  assert.throws(() =>
    gradeQuestion("familiarity-is-not-recall", "recognize", ["close"]),
  );
});

test("free text is saved for transparent self-check, never semantically auto-graded", () => {
  const matching = gradeQuestion(
    "familiarity-is-not-recall",
    "recall",
    "تحتوي النواة المادة الوراثية",
  );
  const unrelated = gradeQuestion(
    "familiarity-is-not-recall",
    "recall",
    "لا أتذكر",
  );
  assert.equal(matching.correct, null);
  assert.equal(unrelated.correct, null);
  assert.equal(matching.gradingSource, "ungraded");
  assert.ok(matching.feedback.includes("البرنامج لم يحكم"));
  assert.throws(() =>
    gradeQuestion("useful-self-test", "write-question", "   "),
  );
});

test("ordering grades full permutations and rejects duplicates or missing items", () => {
  assert.equal(
    gradeQuestion("spaced-practice", "order", ["forgot", "hard", "easy"])
      .correct,
    true,
  );
  assert.equal(
    gradeQuestion("spaced-practice", "order", ["easy", "hard", "forgot"])
      .correct,
    false,
  );
  assert.throws(() =>
    gradeQuestion("spaced-practice", "order", ["forgot", "forgot", "easy"]),
  );
  assert.throws(() =>
    gradeQuestion("spaced-practice", "order", ["forgot", "hard"]),
  );
});

test("prediction is optional ungraded evidence, separate from actual quiz scores", () => {
  assert.ok(
    !getRequiredQuestionIds("metacognitive-calibration").includes("prediction"),
  );
  const predicted = gradeQuestion(
    "metacognitive-calibration",
    "prediction",
    "2",
  );
  assert.equal(predicted.correct, null);
  assert.equal(predicted.gradingSource, "ungraded");
  assert.throws(() =>
    gradeQuestion("metacognitive-calibration", "prediction", "3"),
  );
  assert.equal(
    gradeQuestion("metacognitive-calibration", "organelle", "mitochondria")
      .correct,
    true,
  );
  assert.equal(
    gradeQuestion("metacognitive-calibration", "membrane", "dna").correct,
    false,
  );
  assert.throws(() => gradeQuestion("missing", "recall", "text"));
});
