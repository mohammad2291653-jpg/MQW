import type {
  CycleState,
  PillarKey,
  Schedule,
  ScheduleVersion,
  WorkoutSet,
} from "./evolution";
export type Rating = "again" | "hard" | "good";
export type Entity = {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};
export type User = { id: string; email: string; name: string };
export type Preferences = {
  timezone: string;
  studyMinutes: number;
  personalization: boolean;
  reducedMotion: boolean;
  habitReminder: boolean;
  deadlineNotifications: boolean;
  onboardingDone: boolean;
  [key: string]: unknown;
};
export type LessonAttempt = Entity & {
  lessonSlug: string;
  contentVersion: string;
  status: "in_progress" | "completed";
  step: number;
  completedAt?: string;
};
export type Answer = Entity & {
  attemptId: string;
  questionId: string;
  response: string | string[];
  gradingSource: "deterministic" | "self_report" | "ungraded";
  correct: boolean | null;
  feedback?: string;
  modelAnswer?: string;
  rating?: Rating;
  revealedAt?: string;
};
export type ReviewCard = Entity & {
  lessonSlug?: string;
  questionId?: string;
  prompt: string;
  dueAt: string;
  stage: number;
  target: "question" | "palace";
  algorithm: string;
  lastReviewedAt?: string;
};
export type ReviewEvent = Entity & {
  cardId: string;
  response?: string;
  rating?: Rating;
  correct?: boolean | null;
  modelAnswer?: string;
  kind: "attempt" | "reschedule";
  previousDueAt?: string;
  nextDueAt?: string;
};
export type Association = Entity & {
  locusId: string;
  fact: string;
  image: string;
  version: number;
};
export type PalaceTrial = Entity & {
  status: "in_progress" | "completed";
  kind: "concept" | "route";
  results: {
    locusId: string;
    response: string;
    rating?: Rating;
    skipped?: boolean;
    modelAnswer?: string;
    revealed?: boolean;
  }[];
  completedAt?: string;
  dueAt?: string;
};
export type Note = Entity & {
  title: string;
  text: string;
  journal?: boolean;
  archived?: boolean;
};
export type TimeBlock = {
  date: string;
  start: string;
  end: string;
  timezone: string;
};
export type Task = Entity & {
  title: string;
  importance: number;
  done: boolean;
  dueDate?: string;
  projectId?: string;
  priority?: boolean;
  noteId?: string;
  timeBlock?: TimeBlock | null;
};
export type Habit = Entity & {
  title: string;
  logs: Record<string, "done" | "rest" | "skipped">;
};
export type Goal = Entity & {
  title: string;
  target?: string;
  progress: number;
};
export type Project = Entity & {
  title: string;
  stages: string[];
  stage: number;
};
export type StudySession = Entity & {
  subject: string;
  minutes: number;
  status: "running" | "paused" | "completed";
  startedAt: string;
  elapsedSeconds: number;
  resumedAt?: string;
  outcome?: string;
};
export type Subject = Entity & { title: string; topics: string[] };
export type VoiceAsset = Entity & {
  title: string;
  mimeType: string;
  size: number;
  duration?: number;
};
export type WeeklyReview = Entity & {
  win: string;
  obstacle: string;
  experiment: string;
};
export type InsightFeedback = Entity & {
  ruleId: string;
  action: "dismiss" | "inaccurate";
};
// ---------- MQW 90 — My Evolution ----------
export type EvoGoal = { id: string; title: string; target?: string };
export type EvoCycle = Entity & {
  startDate: string;
  timezone: string;
  state: CycleState;
  goals: EvoGoal[];
  pillars: Record<PillarKey, boolean>;
  balanceDomains: string[];
  pausedAt?: string | null;
  completedAt?: string | null;
  archivedAt?: string | null;
  note?: string;
};
export type EvoDailyStatus =
  "planned" | "done" | "rest" | "skipped" | "postponed" | "not_applicable";
export type EvoDaily = Entity & {
  cycleId: string;
  date: string;
  focus: string;
  status: EvoDailyStatus;
  note?: string;
};
export type EvoArea = "face" | "scalp" | "beard";
export type EvoProduct = Entity & {
  pillar: "skin" | "hair";
  area: EvoArea;
  name: string;
  brand?: string;
  ingredients?: string;
  size?: string;
  source?: string;
  url?: string;
  labelInstructions?: string;
  strengthAsLabelled?: string;
  clinicianNote?: string;
  patchTestNote?: string;
  status: "active" | "paused" | "discontinued";
};
export type EvoRoutineEvent = Entity & {
  cycleId?: string;
  pillar: "skin" | "hair";
  area: EvoArea;
  kind: "application" | "microneedling";
  productId?: string | null;
  date: string;
  time?: string;
  status: "done" | "skipped" | "paused" | "discontinued";
  clinicianEstablished?: boolean;
  irritation: boolean;
  notes?: string;
};
export type EvoObservation = Entity & {
  cycleId?: string;
  pillar: "skin" | "hair";
  area: EvoArea;
  date: string;
  productId?: string | null;
  narrative: string;
  rating?: number | null;
  irritation: boolean;
};
export type EvoPhoto = Entity & {
  pillar: "skin" | "hair" | "fitness";
  area: EvoArea | "body";
  date: string;
  caption?: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
};
export type EvoAgencyReview = Entity & {
  productName: string;
  supplier?: string;
  manufacturer?: string;
  documentsRequested?: string;
  claimsToVerify?: string;
  territory?: string;
  priceNotes?: string;
  checklist: Record<string, boolean>;
  decision: "exploring" | "on_hold" | "declined" | "pursuing";
  notes?: string;
};
export type EvoSupplement = Entity & {
  kind: "supplement" | "medication";
  name: string;
  brand?: string;
  purpose?: string;
  ingredient?: string;
  strength?: string;
  doseText?: string;
  sourceNote?: string;
  contraindicationNote?: string;
  professionalAdvice?: string;
  status: "active" | "paused" | "discontinued";
  startDate: string;
  endDate?: string | null;
  schedule: Schedule;
  scheduleHistory: ScheduleVersion[];
};
export type EvoIntake = Entity & {
  supplementId: string;
  date: string;
  time: string;
  scheduleVersion: number;
  status: "taken" | "skipped" | "postponed" | "not_applicable";
  actualAt?: string | null;
  note?: string;
};
export type EvoExercise = Entity & {
  name: string;
  muscleGroup?: string;
  equipment?: string;
  notes?: string;
  archived: boolean;
};
export type EvoTemplate = Entity & {
  name: string;
  type: "push" | "pull" | "legs" | "custom";
  exerciseIds: string[];
  order: number;
  notes?: string;
};
export type EvoWorkout = Entity & {
  cycleId?: string;
  templateId?: string | null;
  templateName: string;
  type: "push" | "pull" | "legs" | "custom" | "free";
  date: string;
  startedAt: string;
  endedAt?: string | null;
  status: "in_progress" | "completed" | "interrupted";
  sets: WorkoutSet[];
  recovery?: number | null;
  painNote?: string;
  notes?: string;
};
export type EvoRestDay = Entity & {
  cycleId?: string;
  date: string;
  note?: string;
};
export type EvoMetric = Entity & {
  type: string;
  value: number;
  unit: string;
  date: string;
};
export type EvoWellbeing = Entity & {
  date: string;
  mood?: number | null;
  stress?: number | null;
  energy?: number | null;
  note?: string;
};
export type EvoJournal = Entity & {
  date: string;
  prompt: "free" | "emotions" | "boundaries" | "relationships" | "gratitude";
  body: string;
};
export type EvoWeekly = Entity & {
  cycleId: string;
  weekStart: string;
  domains: string[];
  win?: string;
  constraint?: string;
  nextAction?: string;
  balanceRating?: number | null;
};
export type EvoMilestone = Entity & {
  cycleId: string;
  day: 1 | 30 | 60 | 90;
  reflection: string;
};
export type EvolutionCollections = {
  evoCycles: EvoCycle[];
  evoDaily: EvoDaily[];
  evoProducts: EvoProduct[];
  evoRoutineEvents: EvoRoutineEvent[];
  evoObservations: EvoObservation[];
  evoPhotos: EvoPhoto[];
  evoAgencyReviews: EvoAgencyReview[];
  evoSupplements: EvoSupplement[];
  evoIntakes: EvoIntake[];
  evoExercises: EvoExercise[];
  evoTemplates: EvoTemplate[];
  evoWorkouts: EvoWorkout[];
  evoRestDays: EvoRestDay[];
  evoMetrics: EvoMetric[];
  evoWellbeing: EvoWellbeing[];
  evoJournal: EvoJournal[];
  evoWeekly: EvoWeekly[];
  evoMilestones: EvoMilestone[];
};
export type AppState = EvolutionCollections & {
  preferences: Preferences;
  capabilities?: { privatePhotos: boolean };
  lessonAttempts: LessonAttempt[];
  answers: Answer[];
  reviews: ReviewCard[];
  reviewEvents: ReviewEvent[];
  associations: Association[];
  palaceTrials: PalaceTrial[];
  notes: Note[];
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  projects: Project[];
  studySessions: StudySession[];
  subjects: Subject[];
  voiceAssets: VoiceAsset[];
  weeklyReviews: WeeklyReview[];
  insightFeedback: InsightFeedback[];
};
export type Collection = Exclude<
  keyof AppState,
  "preferences" | "capabilities"
>;
export type ApiResult<T> =
  { data: T; error?: never } | { error: string; data?: never };
