/** SERVER ONLY. Do not import from a client component or include in public lesson payloads. */
import { getLesson } from "../lessons";

type Grade = {
  correct: boolean | null;
  gradingSource: "deterministic" | "self_report" | "ungraded";
  feedback: string;
  modelAnswer: string;
  prompt: string;
};
type Key = {
  answer?: string | string[];
  modelAnswer: string;
  feedback: string;
  wrong?: Record<string, string>;
};
const KEYS: Record<string, Record<string, Key>> = {
  "familiarity-is-not-recall": {
    recall: {
      modelAnswer: "تحتوي النواة معظم المادة الوراثية في الخلية حقيقية النواة.",
      feedback:
        "معيار التحقق: هل ذكرت ارتباط النواة بالمادة الوراثية؟ لا يلزم تطابق الكلمات. قيّم إجابتك بنفسك؛ البرنامج لم يحكم على معناها.",
    },
    recognize: {
      answer: "close",
      modelAnswer: "أغلق المصدر، أحاول الإجابة، ثم أتحقق.",
      feedback:
        "إغلاق المصدر يجعل الاستدعاء مطلوبًا، والتحقق يصحح الخطأ. إعادة القراءة والتلوين قد يساعدان في التنظيم، لكنهما لا يختبران الاستدعاء وحدهما.",
      wrong: {
        reread:
          "سهولة إعادة القراءة قد تعكس الألفة. اختبر قدرتك على إخراج الفكرة دون رؤيتها.",
        highlight:
          "التلوين يحدد ما تريد مراجعته، لكنه لا يثبت أنك تستطيع استدعاءه.",
      },
    },
  },
  "useful-self-test": {
    "prompt-choice": {
      answer: "function",
      modelAnswer: "ما دور الميتوكوندريا في إمداد الخلية بالطاقة؟",
      feedback:
        "السؤال يطلب وظيفة محددة ويخفي الإجابة، لذلك يمكنك استدعاؤها ثم التحقق. الإحساس بالألفة لا يقدم إجابة قابلة للتحقق، والسؤال الذي يتضمن الإجابة يقيس الموافقة عليها أكثر من الاستدعاء.",
      wrong: {
        familiar:
          "الإحساس بالألفة ليس إجابة يمكن التحقق منها. اطلب معلومة محددة.",
        leading:
          "السؤال يتضمن الإجابة ويوحي بالموافقة؛ احذفها واطلب الوظيفة مباشرة.",
      },
    },
    "write-question": {
      modelAnswer:
        "مثال مقبول: ما دور الغشاء الخلوي في مرور المواد بين الخلية وبيئتها؟",
      feedback:
        "معيار ذاتي: ١) يطلب وظيفة الغشاء، ٢) لا يذكر الإجابة كاملة، ٣) إجابته قابلة للتحقق من المعلومة. إن تحقق ذلك فاختر «تذكرت / أنجزت المعيار». توجد صياغات صحيحة أخرى؛ لا تقييم دلاليًا آليًا هنا.",
    },
  },
  "spaced-practice": {
    order: {
      answer: ["forgot", "hard", "easy"],
      modelAnswer: "لم أستطع الاستدعاء ← استدعيت بصعوبة ← استدعيت بسهولة.",
      feedback:
        "مع تساوي الأهمية ووقت المراجعة، تبدأ بما لم تستدعه، ثم ما استدعيته بصعوبة. هذه قاعدة مبسطة للتمرين، وليست تقديرًا دقيقًا لقوة الذاكرة.",
    },
    "spacing-choice": {
      answer: "spaced",
      modelAnswer: "محاولات استدعاء تفصل بينها أوقات مختلفة.",
      feedback:
        "الفواصل تمنحك فرصًا للاستدعاء في أوقات منفصلة. التكرار الفوري وحده قد يسهل الإجابة الآن؛ إبقاء المصدر مفتوحًا لا يطلب استدعاء مستقلًا.",
    },
  },
  "metacognitive-calibration": {
    prediction: {
      modelAnswer: "",
      feedback: "حُفظ توقعك قبل الاختبار. ستقارنه بنتيجة سؤالين فقط.",
    },
    organelle: {
      answer: "mitochondria",
      modelAnswer: "الميتوكوندريا تشارك في إنتاج ATP.",
      feedback:
        "ذكر المثال دور الميتوكوندريا في إنتاج ATP. النواة ترتبط بالمادة الوراثية، والغشاء ينظم مرور المواد؛ لكل تركيب وظائف مختلفة.",
    },
    membrane: {
      answer: "regulate",
      modelAnswer:
        "يساعد الغشاء الخلوي في تنظيم مرور المواد بين الخلية وبيئتها.",
      feedback:
        "هذا هو الدور الوارد في المثال. حفظ معظم المادة الوراثية وظيفة مرتبطة بالنواة، وإنتاج كل الطاقة وحده ليس وصفًا صحيحًا للغشاء.",
    },
  },
};

export function getLessonVersion(slug: string): string | undefined {
  return getLesson(slug)?.version;
}
export function gradeQuestion(
  lessonSlug: string,
  questionId: string,
  response: string | string[],
): Grade {
  const lesson = getLesson(lessonSlug);
  const key = KEYS[lessonSlug]?.[questionId];
  const step = lesson?.steps.find(
    (item) => "questionId" in item && item.questionId === questionId,
  );
  if (!key || !step || !("prompt" in step))
    throw new Error("السؤال غير موجود في إصدار الدرس.");
  if (
    (step.type === "single_choice" ||
      step.type === "short_answer_self_check" ||
      step.type === "confidence") &&
    typeof response !== "string"
  )
    throw new Error("هذا السؤال يحتاج إجابة واحدة.");
  if (
    questionId === "prediction" &&
    (typeof response !== "string" || !["0", "1", "2"].includes(response))
  )
    throw new Error("اختر توقعًا بين صفر واثنين.");
  if (typeof response === "string" ? !response.trim() : response.length === 0)
    throw new Error("اكتب إجابة قبل الإرسال.");
  if (
    "options" in step &&
    step.options &&
    step.type !== "order" &&
    step.type !== "match"
  ) {
    const ids = new Set(step.options.map((option) => option.id));
    if (
      (Array.isArray(response) ? response : [response]).some(
        (value) => !ids.has(value),
      )
    )
      throw new Error("الخيار غير صالح لهذا السؤال.");
  }
  if (
    (step.type === "order" || step.type === "match") &&
    (!Array.isArray(response) ||
      response.length !== step.options?.length ||
      new Set(response).size !== response.length ||
      response.some(
        (value) => !step.options?.some((option) => option.id === value),
      ))
  )
    throw new Error("أرسل جميع العناصر مرة واحدة.");
  const correct =
    key.answer === undefined
      ? null
      : Array.isArray(key.answer)
        ? Array.isArray(response) &&
          key.answer.length === response.length &&
          key.answer.every((value, index) => value === response[index])
        : response === key.answer;
  const selectedReason =
    !correct && typeof response === "string"
      ? key.wrong?.[response]
      : undefined;
  return {
    correct,
    gradingSource: key.answer === undefined ? "ungraded" : "deterministic",
    feedback: selectedReason
      ? `${selectedReason} ${key.feedback}`
      : key.feedback,
    modelAnswer: key.modelAnswer,
    prompt: step.prompt,
  };
}

export function getReviewQuestion(
  slug: string,
): { questionId: string; prompt: string; modelAnswer: string } | undefined {
  const review: Record<
    string,
    { questionId: string; prompt: string; modelAnswer: string }
  > = {
    "familiarity-is-not-recall": {
      questionId: "review-active-recall",
      prompt: "دون فتح الدرس: ما الفرق بين الألفة بالمعلومة واختبار استدعائها؟",
      modelAnswer:
        "الألفة شعور بأن المعلومة معروفة عند رؤيتها؛ اختبار الاستدعاء يعني محاولة الإجابة دون المصدر ثم التحقق.",
    },
    "useful-self-test": {
      questionId: "review-prompt",
      prompt: "ما ثلاثة معايير تجعل سؤال الاختبار الذاتي مفيدًا؟",
      modelAnswer:
        "يطلب معلومة محددة، لا يتضمن الإجابة، ويمكن التحقق من إجابته بمعيار واضح.",
    },
    "spaced-practice": {
      questionId: "review-spacing",
      prompt:
        "ما الممارسة المتباعدة؟ وهل تغيير موعد المراجعة يغيّر نتيجة اختبارك؟",
      modelAnswer:
        "استدعاء المعلومات في أوقات تفصل بينها فواصل. تغيير الموعد ينظم المراجعة ولا يغير صحة إجابة محفوظة.",
    },
    "metacognitive-calibration": {
      questionId: "review-calibration",
      prompt:
        "كيف تتحقق من دقة توقعك لفهم فقرة؟ وهل تكفي نتيجة سؤالين لتصنيف قدراتك؟",
      modelAnswer:
        "أسجل توقعًا قبل الاختبار، ثم أقارنه بنتيجة فعلية. سؤالان عينة صغيرة لا تكفي لاستنتاج سمة ثابتة أو تصنيف القدرة.",
    },
  };
  return review[slug];
}
