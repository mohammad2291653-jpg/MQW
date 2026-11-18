import type {
  Answer,
  LessonAttempt,
  Rating,
  ReviewCard,
  ReviewEvent,
} from "../types";
import {
  ApiError,
  createEntity,
  getEntity,
  getSecret,
  idempotent,
  listEntities,
  requireEntity,
  updateEntity,
} from "./db";
import { text } from "./http";
import {
  gradeQuestion,
  getLessonVersion,
  getReviewQuestion,
} from "./lesson-keys";
import { getLesson, getRequiredQuestionIds } from "../lessons";
const DAY = 86400000;
const INTERVALS = [1, 3, 7, 14, 30];
function rating(value: unknown): Rating {
  if (!["again", "hard", "good"].includes(String(value)))
    throw new ApiError("اختر تقييمًا صالحًا.");
  return value as Rating;
}
function response(value: unknown): string | string[] {
  if (typeof value === "string" && value.length <= 20000) return value;
  if (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every((v) => typeof v === "string" && v.length < 1000)
  )
    return value;
  throw new ApiError("الإجابة غير صالحة.");
}
export function learningAction(userId: string, b: Record<string, unknown>) {
  switch (b.action) {
    case "start": {
      const slug = text(b.lessonSlug, "الدرس", 100);
      const version = getLessonVersion(slug);
      if (!version) throw new ApiError("الدرس غير موجود.", 404);
      const existing = listEntities<LessonAttempt>(
        userId,
        "lessonAttempts",
      ).find(
        (a) =>
          a.lessonSlug === slug &&
          a.contentVersion === version &&
          a.status === "in_progress",
      );
      return {
        attempt:
          existing ||
          createEntity<LessonAttempt>(userId, "lessonAttempts", {
            lessonSlug: slug,
            contentVersion: version,
            status: "in_progress",
            step: 0,
          }),
      };
    }
    case "progress": {
      const a = requireEntity<LessonAttempt>(
        userId,
        "lessonAttempts",
        text(b.attemptId),
      );
      if (a.status === "completed") return { attempt: a };
      if (
        typeof b.step !== "number" ||
        !Number.isInteger(b.step) ||
        b.step < 0 ||
        b.step > 100
      )
        throw new ApiError("خطوة الدرس غير صالحة.");
      const lesson = getLesson(a.lessonSlug);
      if (!lesson || b.step >= lesson.steps.length || b.step > a.step + 1)
        throw new ApiError("انتقل بين خطوات الدرس بالترتيب.");
      const current = lesson.steps[a.step];
      if (
        b.step > a.step &&
        "questionId" in current &&
        getRequiredQuestionIds(a.lessonSlug).includes(current.questionId)
      ) {
        const done = listEntities<Answer>(userId, "answers").some(
          (x) =>
            x.attemptId === a.id &&
            x.questionId === current.questionId &&
            (x.gradingSource === "deterministic" || x.rating),
        );
        if (!done) throw new ApiError("احفظ إجابتك وتقييمها قبل المتابعة.");
      }
      const patch: Record<string, unknown> = { step: b.step };
      if (b.draftQuestionId !== undefined) {
        const alreadyAnswered = listEntities<Answer>(userId, "answers").some(
          (x) => x.attemptId === a.id && x.questionId === b.draftQuestionId,
        );
        if (alreadyAnswered) return { attempt: a };
        const target = lesson.steps[b.step];
        if (
          !("questionId" in target) ||
          target.questionId !== b.draftQuestionId
        )
          throw new ApiError("المسودة لا تطابق خطوة السؤال.");
        patch.draftQuestionId = text(b.draftQuestionId, "السؤال", 100);
        patch.draftResponse = response(b.draftResponse);
      }
      return { attempt: updateEntity(userId, "lessonAttempts", a.id, patch) };
    }
    case "submit": {
      const a = requireEntity<LessonAttempt>(
        userId,
        "lessonAttempts",
        text(b.attemptId),
      );
      const questionId = text(b.questionId, "السؤال", 100);
      const answer = response(b.response);
      return idempotent(
        userId,
        text(b.submissionId, "معرّف الحفظ", 150),
        `lesson:${a.id}:${questionId}:${JSON.stringify(answer)}`,
        () => {
          const prior = listEntities<Answer>(userId, "answers").filter(
            (x) => x.attemptId === a.id,
          );
          const duplicate = prior.find((x) => x.questionId === questionId);
          if (duplicate) {
            if (JSON.stringify(duplicate.response) === JSON.stringify(answer))
              return { answer: duplicate };
            throw new ApiError(
              "الإجابة محفوظة. أعد الدرس لمحاولة جديدة دون تغيير الدليل الأول.",
              409,
            );
          }
          if (
            questionId === "prediction" &&
            prior.some((x) => x.gradingSource === "deterministic")
          )
            throw new ApiError(
              "التوقع يسبق الاختبار. ابدأ محاولة جديدة لتسجيل توقعك.",
              409,
            );
          if (a.status === "completed")
            throw new ApiError("هذا الدرس مكتمل. ابدأ محاولة جديدة لإعادته.");
          if (a.contentVersion !== getLessonVersion(a.lessonSlug))
            throw new ApiError(
              "هذا إصدار قديم؛ ابدأ محاولة بإصدار الدرس الحالي. تبقى إجابتك القديمة محفوظة.",
              409,
            );
          let grade;
          try {
            grade = gradeQuestion(a.lessonSlug, questionId, answer);
          } catch (error) {
            throw new ApiError(
              error instanceof Error ? error.message : "الإجابة غير صالحة.",
              400,
            );
          }
          if (a.draftQuestionId === questionId)
            updateEntity(userId, "lessonAttempts", a.id, {
              draftQuestionId: null,
              draftResponse: null,
            });
          const saved = createEntity<Answer>(userId, "answers", {
            attemptId: a.id,
            questionId,
            response: answer,
            gradingSource: grade.gradingSource,
            correct: grade.correct,
            feedback: grade.feedback,
            modelAnswer: grade.modelAnswer,
            revealedAt: new Date().toISOString(),
          });
          return { answer: saved };
        },
      );
    }
    case "self-grade": {
      const a = requireEntity<Answer>(userId, "answers", text(b.answerId));
      if (a.gradingSource === "deterministic")
        throw new ApiError("هذا السؤال مصحّح بقواعد واضحة.");
      const r = rating(b.rating);
      if (a.rating && a.rating !== r)
        throw new ApiError(
          "التقييم محفوظ؛ أعد المحاولة لإنشاء دليل جديد.",
          409,
        );
      return idempotent(
        userId,
        text(b.submissionId, "معرّف الحفظ", 150),
        `self:${a.id}:${r}`,
        () => ({
          answer: updateEntity(userId, "answers", a.id, {
            rating: r,
            gradingSource: "self_report",
            correct: null,
            ratingHistory: [
              {
                rating: r,
                createdAt: new Date().toISOString(),
                source: "self_report",
              },
            ],
          }),
        }),
      );
    }
    case "complete": {
      const a = requireEntity<LessonAttempt>(
        userId,
        "lessonAttempts",
        text(b.attemptId),
      );
      if (a.contentVersion !== getLessonVersion(a.lessonSlug))
        throw new ApiError(
          "إصدار الدرس تغيّر؛ ابدأ محاولة جديدة مع الاحتفاظ بالسجل القديم.",
          409,
        );
      const answers = listEntities<Answer>(userId, "answers").filter(
        (x) => x.attemptId === a.id,
      );
      const required = getRequiredQuestionIds(a.lessonSlug);
      if (
        required.some(
          (q) =>
            !answers.some(
              (x) =>
                x.questionId === q &&
                (x.gradingSource === "deterministic" || x.rating),
            ),
        )
      )
        throw new ApiError("أكمل الأسئلة والتقييم الذاتي أولًا.");
      const q = getReviewQuestion(a.lessonSlug);
      if (!q) throw new ApiError("تعذّر تحديد سؤال المراجعة.");
      const existing = listEntities<ReviewCard>(userId, "reviews").find(
        (r) => r.lessonSlug === a.lessonSlug && r.questionId === q.questionId,
      );
      const review =
        existing ||
        createEntity<ReviewCard>(
          userId,
          "reviews",
          {
            lessonSlug: a.lessonSlug,
            questionId: q.questionId,
            prompt: q.prompt,
            dueAt: new Date(Date.now() + DAY).toISOString(),
            stage: 0,
            target: "question",
            algorithm: "fixed-v1",
          },
          { modelAnswer: q.modelAnswer, contentVersion: a.contentVersion },
        );
      return {
        attempt:
          a.status === "completed"
            ? a
            : updateEntity(userId, "lessonAttempts", a.id, {
                status: "completed",
                completedAt: new Date().toISOString(),
              }),
        review,
      };
    }
    default:
      throw new ApiError("عملية الدرس غير معروفة.");
  }
}
export function reviewsAction(userId: string, b: Record<string, unknown>) {
  switch (b.action) {
    case "submit": {
      const card = requireEntity<ReviewCard>(userId, "reviews", text(b.cardId));
      if (card.target !== "question")
        throw new ApiError("ابدأ اختبار القصر من صفحة قصري.");
      const answer = response(b.response);
      const secret = getSecret<{ modelAnswer: string }>(
        userId,
        "reviews",
        card.id,
      );
      return idempotent(
        userId,
        text(b.submissionId, "معرّف الحفظ", 150),
        `review:${card.id}:${JSON.stringify(answer)}`,
        () => ({
          event: createEntity<ReviewEvent>(userId, "reviewEvents", {
            cardId: card.id,
            response: Array.isArray(answer) ? answer.join("، ") : answer,
            modelAnswer: secret.modelAnswer,
            kind: "attempt",
            correct: null,
          }),
          modelAnswer: secret.modelAnswer,
        }),
      );
    }
    case "rate": {
      const event = requireEntity<ReviewEvent>(
        userId,
        "reviewEvents",
        text(b.eventId),
      );
      const card = requireEntity<ReviewCard>(userId, "reviews", event.cardId);
      if (event.kind !== "attempt")
        throw new ApiError("لا يمكن تقييم تغيير الموعد.");
      if (event.rating) return { review: card };
      const r = rating(b.rating);
      const stage =
        r === "again"
          ? 0
          : r === "hard"
            ? card.stage
            : Math.min(card.stage + 1, INTERVALS.length - 1);
      const days = r === "hard" ? 1 : INTERVALS[stage];
      const dueAt = new Date(Date.now() + days * DAY).toISOString();
      updateEntity(userId, "reviewEvents", event.id, {
        rating: r,
        nextDueAt: dueAt,
      });
      return {
        review: updateEntity(userId, "reviews", card.id, {
          stage,
          dueAt,
          lastReviewedAt: new Date().toISOString(),
        }),
      };
    }
    case "reschedule": {
      const card = requireEntity<ReviewCard>(userId, "reviews", text(b.cardId));
      const dueAt = text(b.dueAt, "الموعد", 100);
      if (!Number.isFinite(Date.parse(dueAt)))
        throw new ApiError("الموعد غير صالح.");
      const normalized = new Date(dueAt).toISOString();
      createEntity(userId, "reviewEvents", {
        cardId: card.id,
        kind: "reschedule",
        previousDueAt: card.dueAt,
        nextDueAt: normalized,
      });
      return {
        review: updateEntity(userId, "reviews", card.id, { dueAt: normalized }),
      };
    }
    default:
      throw new ApiError("عملية المراجعة غير معروفة.");
  }
}
