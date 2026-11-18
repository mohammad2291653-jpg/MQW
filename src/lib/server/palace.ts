import { LOCI, PALACE_VERSION } from "../palace";
import type { Association, PalaceTrial, Rating, ReviewCard } from "../types";
import {
  ApiError,
  createEntity,
  deleteEntity,
  getSecret,
  listEntities,
  requireEntity,
  updateEntity,
} from "./db";
import { optionalText, text } from "./http";

type Snapshot = {
  locusId: string;
  answer: string;
  image: string;
  associationVersion?: number;
};
type TrialSecret = { snapshot: Snapshot[] };
const ratings: Rating[] = ["again", "hard", "good"];

async function currentTrial(userId: string, id: unknown) {
  return await requireEntity<PalaceTrial>(
    userId,
    "palaceTrials",
    text(id, "الاختبار", 100),
  );
}
function expectedLocus(trial: PalaceTrial) {
  const ids = trial.locusIds as string[];
  return ids.find(
    (id) =>
      !trial.results.some(
        (result) => result.locusId === id && (result.rating || result.skipped),
      ),
  );
}
async function updateTrial(
  userId: string,
  trial: PalaceTrial,
  results: PalaceTrial["results"],
) {
  return await updateEntity<PalaceTrial>(userId, "palaceTrials", trial.id, {
    results,
  });
}

export async function palaceAction(
  userId: string,
  body: Record<string, unknown>,
): Promise<Association | PalaceTrial | { deleted: boolean }> {
  const action = text(body.action, "العملية", 50);
  if (action === "save-association" || action === "delete-association") {
    const locusId = text(body.locusId, "المكان", 50);
    if (!LOCI.some((locus) => locus.id === locusId))
      throw new ApiError("المكان غير موجود.");
    const old = (await listEntities<Association>(userId, "associations")).find(
      (association) => association.locusId === locusId,
    );
    if (action === "delete-association") {
      if (old) await deleteEntity(userId, "associations", old.id);
      return { deleted: true };
    }
    const fact = text(body.fact, "المعلومة", 3000);
    const image = text(body.image, "الصورة الذهنية", 3000);
    if (old && old.fact === fact && old.image === image) return old;
    if (old)
      return await updateEntity<Association>(userId, "associations", old.id, {
        fact,
        image,
        version: old.version + 1,
      });
    return await createEntity<Association>(userId, "associations", {
      locusId,
      fact,
      image,
      version: 1,
    });
  }
  if (action === "start") {
    const kind = body.kind === "route" ? "route" : "concept";
    const active = (
      await listEntities<PalaceTrial>(userId, "palaceTrials")
    ).find((trial) => trial.status === "in_progress" && trial.kind === kind);
    if (active) return active;
    const associations = await listEntities<Association>(
      userId,
      "associations",
    );
    const snapshot: Snapshot[] =
      kind === "route"
        ? LOCI.map((locus, i) => ({
            locusId: `position-${i + 1}`,
            answer: locus.id,
            image: "",
          }))
        : LOCI.flatMap((locus) => {
            const association = associations.find(
              (item) => item.locusId === locus.id,
            );
            return association
              ? [
                  {
                    locusId: locus.id,
                    answer: association.fact,
                    image: association.image,
                    associationVersion: association.version,
                  },
                ]
              : [];
          });
    if (!snapshot.length)
      throw new ApiError("اربط معلومة بمكان واحد على الأقل قبل بدء الاسترجاع.");
    return await createEntity<PalaceTrial>(
      userId,
      "palaceTrials",
      {
        kind,
        status: "in_progress",
        routeVersion: PALACE_VERSION,
        locusIds: snapshot.map((item) => item.locusId),
        results: [],
        gradingSource: kind === "route" ? "deterministic" : "self_report",
      },
      { snapshot },
    );
  }

  const trial = await currentTrial(userId, body.trialId);
  if (action === "resume") return trial;
  if (action === "complete") {
    if (trial.status === "completed") return trial;
    if (expectedLocus(trial))
      throw new ApiError("أكمل تقييم المواقع أو تخطّها قبل إنهاء الاختبار.");
    const dueAt = body.retestAt
      ? text(body.retestAt, "موعد المراجعة", 50)
      : new Date(Date.now() + 86400000).toISOString();
    const dueTime = new Date(dueAt).getTime();
    if (
      !Number.isFinite(dueTime) ||
      dueTime <= Date.now() ||
      dueTime > Date.now() + 366 * 86400000
    )
      throw new ApiError("اختر موعد مراجعة مستقبليًا خلال سنة.");
    const normalizedDue = new Date(dueTime).toISOString();
    const existing = (await listEntities<ReviewCard>(userId, "reviews")).find(
      (card) => card.target === "palace" && card.palaceKind === trial.kind,
    );
    if (existing) {
      await createEntity(userId, "reviewEvents", {
        cardId: existing.id,
        kind: "attempt",
        palaceTrialId: trial.id,
        gradingSource: trial.kind === "route" ? "deterministic" : "self_report",
        nextDueAt: normalizedDue,
      });
      await updateEntity(userId, "reviews", existing.id, {
        dueAt: normalizedDue,
        lastReviewedAt: new Date().toISOString(),
        palaceTrialId: trial.id,
        stage: existing.stage + 1,
      });
    } else {
      await createEntity(userId, "reviews", {
        target: "palace",
        palaceKind: trial.kind,
        palaceTrialId: trial.id,
        prompt:
          trial.kind === "route"
            ? "استرجاع ترتيب طريق القصر"
            : "استرجاع معلومات قصر الذاكرة",
        dueAt: normalizedDue,
        stage: 0,
        algorithm: "palace-fixed-v1",
      });
    }
    return await updateEntity<PalaceTrial>(userId, "palaceTrials", trial.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      dueAt: normalizedDue,
    });
  }

  const locusId = text(body.locusId, "المكان", 50);
  if (!(trial.locusIds as string[]).includes(locusId))
    throw new ApiError("المكان ليس جزءًا من هذا الاختبار.");
  const existing = trial.results.find((result) => result.locusId === locusId);
  // Repeated network requests return their already persisted result rather than rewriting evidence.
  if (
    existing &&
    (action === "submit" ||
      (action === "skip" && existing.skipped) ||
      (action === "reveal" && existing.revealed) ||
      (action === "rate" && existing.rating))
  )
    return trial;
  if (trial.status !== "in_progress")
    throw new ApiError("هذا الاختبار مكتمل؛ ابدأ محاولة جديدة.", 409);
  if (expectedLocus(trial) !== locusId)
    throw new ApiError("أكمل المكان الحالي أولًا.", 409);
  const snapshot = (
    await getSecret<TrialSecret>(userId, "palaceTrials", trial.id)
  ).snapshot.find((item) => item.locusId === locusId);
  if (!snapshot) throw new ApiError("تعذّر العثور على نسخة الاختبار.", 409);

  if (action === "submit") {
    const response = optionalText(body.response, 4000).trim();
    if (trial.kind === "route") {
      if (!LOCI.some((locus) => locus.id === response))
        throw new ApiError("اختر مكانًا من القائمة.");
      const correct = response === snapshot.answer;
      return await updateTrial(userId, trial, [
        ...trial.results,
        {
          locusId,
          response,
          revealed: true,
          modelAnswer:
            LOCI.find((locus) => locus.id === snapshot.answer)?.name ??
            snapshot.answer,
          rating: correct ? "good" : "again",
        },
      ]);
    }
    return await updateTrial(userId, trial, [
      ...trial.results,
      { locusId, response },
    ]);
  }
  if (action === "skip") {
    if (existing?.response || existing?.revealed)
      throw new ApiError("قيّم إجابتك بعد كشفها بدل التخطي.");
    return await updateTrial(userId, trial, [
      ...trial.results.filter((item) => item.locusId !== locusId),
      { locusId, response: "", skipped: true },
    ]);
  }
  if (action === "reveal") {
    if (!existing) throw new ApiError("احفظ محاولة الاسترجاع قبل كشف الإجابة.");
    return await updateTrial(
      userId,
      trial,
      trial.results.map((result) =>
        result.locusId === locusId
          ? { ...result, revealed: true, modelAnswer: snapshot.answer }
          : result,
      ),
    );
  }
  if (action === "rate") {
    if (!existing?.revealed)
      throw new ApiError("اكشف الإجابة وقارنها بمحاولتك أولًا.");
    if (!ratings.includes(body.rating as Rating))
      throw new ApiError("اختر تقييمًا صالحًا.");
    return await updateTrial(
      userId,
      trial,
      trial.results.map((result) =>
        result.locusId === locusId
          ? { ...result, rating: body.rating as Rating }
          : result,
      ),
    );
  }
  throw new ApiError("العملية غير معروفة.");
}
