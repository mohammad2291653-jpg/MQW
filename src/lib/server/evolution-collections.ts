/** MQW 90 collection names (kept dependency-free to avoid import cycles with db.ts). */
export const EVO_COLLECTIONS = [
  "evoCycles",
  "evoDaily",
  "evoProducts",
  "evoRoutineEvents",
  "evoObservations",
  "evoAgencyReviews",
  "evoSupplements",
  "evoIntakes",
  "evoExercises",
  "evoTemplates",
  "evoWorkouts",
  "evoRestDays",
  "evoMetrics",
  "evoWellbeing",
  "evoJournal",
  "evoWeekly",
  "evoMilestones",
] as const;
/** Photos are listed in state but written only through the private media route. */
export const EVO_STATE_COLLECTIONS = [...EVO_COLLECTIONS, "evoPhotos"] as const;
