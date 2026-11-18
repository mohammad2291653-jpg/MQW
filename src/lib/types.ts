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
export type AppState = {
  preferences: Preferences;
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
export type Collection = Exclude<keyof AppState, "preferences">;
export type ApiResult<T> =
  { data: T; error?: never } | { error: string; data?: never };
