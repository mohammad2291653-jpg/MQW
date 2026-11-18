import type { Association, PalaceTrial, Rating } from "./types";

export const PALACE_VERSION = "mqw-house-v1";
export const LOCI = [
  {
    id: "entrance",
    name: "المدخل",
    english: "Entrance",
    number: 1,
    cue: "الباب المقوّس والنبتة الكبيرة",
    color: "#bd9166",
    x: 350,
    y: 398,
  },
  {
    id: "hallway",
    name: "الممر",
    english: "Hallway",
    number: 2,
    cue: "مرآة طويلة وضوء ينساب في الممر",
    color: "#73938b",
    x: 350,
    y: 270,
  },
  {
    id: "living-room",
    name: "غرفة الجلوس",
    english: "Living room",
    number: 3,
    cue: "أريكة خضراء وطاولة مستديرة",
    color: "#648678",
    x: 525,
    y: 310,
  },
  {
    id: "kitchen",
    name: "المطبخ",
    english: "Kitchen",
    number: 4,
    cue: "إبريق أصفر فوق طاولة المطبخ",
    color: "#b99a5b",
    x: 525,
    y: 122,
  },
  {
    id: "library",
    name: "المكتبة",
    english: "Library",
    number: 5,
    cue: "رفوف الكتب والكرسي قرب النافذة",
    color: "#788eaa",
    x: 175,
    y: 122,
  },
] as const;

export type LocusId = (typeof LOCI)[number]["id"];
export const PALACE_LOCI = LOCI;
export const getLocus = (id: string) => LOCI.find((locus) => locus.id === id);

export const EXAMPLE_ASSOCIATIONS = [
  {
    locusId: "entrance",
    fact: "الغشاء الخلوي ينظّم مرور المواد إلى الخلية ومنها.",
    image: "أتخيّل الباب حارسًا يختار ما يسمح له بالدخول والخروج.",
  },
  {
    locusId: "hallway",
    fact: "النواة تحتوي معظم المادة الوراثية في الخلية حقيقية النواة.",
    image: "أتخيّل في المرآة خزانة تحفظ كتاب تعليمات الخلية.",
  },
  {
    locusId: "living-room",
    fact: "الريبوسومات تشارك في بناء البروتينات.",
    image: "أتخيّل على الأريكة عمّالًا صغارًا يربطون خرزًا ليبنوا بروتينًا.",
  },
  {
    locusId: "kitchen",
    fact: "الميتوكوندريا تنتج معظم طاقة ATP في كثير من الخلايا حقيقية النواة.",
    image: "أتخيّل الإبريق محطة طاقة تملأ أكوابًا مكتوبًا عليها ATP.",
  },
  {
    locusId: "library",
    fact: "البلاستيدات الخضراء تقوم بالبناء الضوئي في الخلايا النباتية.",
    image: "أتخيّل الكتب أوراقًا خضراء تمسك بضوء النافذة لتصنع السكر.",
  },
] satisfies Pick<Association, "locusId" | "fact" | "image">[];

export function trialLocusIds(
  trial: PalaceTrial,
  associations: Association[],
): string[] {
  const stored = trial.locusIds;
  if (Array.isArray(stored) && stored.every((id) => typeof id === "string"))
    return stored;
  if (trial.kind === "route") return LOCI.map((locus) => locus.id);
  return LOCI.filter((locus) =>
    associations.some((association) => association.locusId === locus.id),
  ).map((locus) => locus.id);
}

export function trialSummary(trial: PalaceTrial) {
  const answered = trial.results.filter(
    (result) => !result.skipped && result.rating,
  );
  return {
    answered: answered.length,
    recalled: answered.filter((result) => result.rating === "good").length,
    partial: answered.filter((result) => result.rating === "hard").length,
    again: answered.filter((result) => result.rating === "again").length,
    skipped: trial.results.filter((result) => result.skipped).length,
  };
}

export const RATING_LABELS: Record<Rating, string> = {
  again: "لم أتذكّر",
  hard: "تذكّرت جزءًا",
  good: "تذكّرت بوضوح",
};

export function palaceTrialIsFinished(trial: PalaceTrial, ids: string[]) {
  return (
    ids.length > 0 &&
    ids.every((id) =>
      trial.results.some(
        (result) => result.locusId === id && (result.skipped || result.rating),
      ),
    )
  );
}
