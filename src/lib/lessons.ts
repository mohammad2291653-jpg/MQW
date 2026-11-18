/** Public, versioned lesson definitions. Answer keys belong exclusively on the server. */
export type LessonOption = { id: string; label: string };
export type LessonStep =
  | {
      id: string;
      type: "explainer";
      title: string;
      paragraphs: string[];
      takeaway?: string;
    }
  | {
      id: string;
      type: "confidence";
      questionId: string;
      title: string;
      prompt: string;
      maximum: number;
    }
  | {
      id: string;
      type:
        | "single_choice"
        | "multiple_choice"
        | "order"
        | "match"
        | "short_answer_self_check";
      questionId: string;
      title: string;
      prompt: string;
      options?: LessonOption[];
      placeholder?: string;
      hint?: string;
    }
  | { id: string; type: "review_creation"; title: string; paragraphs: string[] }
  | { id: string; type: "reflection"; title: string; prompt: string };
export type Lesson = {
  slug: string;
  number: number;
  version: string;
  title: string;
  english: string;
  description: string;
  duration: string;
  color: string;
  outcome: string;
  requiredQuestionIds: string[];
  steps: LessonStep[];
};

export const LESSONS: Lesson[] = [
  {
    slug: "familiarity-is-not-recall",
    number: 1,
    version: "1.0.0",
    title: "الألفة ليست تذكّرًا",
    english: "Active Recall",
    description: "جرّب الفرق بين «هذا مألوف» و«أستطيع استدعاءه».",
    duration: "نحو ٥–٨ دقائق",
    color: "teal",
    outcome: "تختبر ما تتذكره قبل أن تعود إلى المصدر.",
    requiredQuestionIds: ["recall", "recognize"],
    steps: [
      {
        id: "welcome",
        type: "explainer",
        title: "القراءة بداية… والاختبار يكشف الفرق",
        paragraphs: [
          "عندما تقرأ معلومة أكثر من مرة، قد تصبح مألوفة. لكن سهولة القراءة لا تضمن أنك ستستدعيها حين تحتاج إليها. الاستدعاء النشط (Active Recall) يعني محاولة إخراج المعلومة من الذاكرة قبل النظر إلى الإجابة.",
          "سنستخدم مثالًا تعليميًا أصليًا من الأحياء: تحتوي النواة معظم المادة الوراثية في الخلية حقيقية النواة. ويساعد الغشاء الخلوي في تنظيم مرور المواد بين الخلية وبيئتها.",
          "اقرأ المثال بهدوء. في الخطوة التالية سيختفي النص، وستحاول استدعاء معلومة منه بكلماتك. هذا تمرين صغير، وليس امتحانًا لمعرفتك السابقة.",
        ],
        takeaway: "اختبر نفسك أولًا، ثم ارجع إلى المصدر لتصحّح فهمك.",
      },
      {
        id: "recall-step",
        type: "short_answer_self_check",
        questionId: "recall",
        title: "أغلق المصدر واستدعِ",
        prompt: "ما وظيفة النواة التي قرأتها؟ اكتب ما تتذكره قبل كشف المثال.",
        placeholder: "أتذكر أن النواة…",
        hint: "لن نقيّم معنى نصك آليًا. بعد حفظه ستقارن إجابتك بمعيار واضح وتقيّم نفسك.",
      },
      {
        id: "recognize-step",
        type: "single_choice",
        questionId: "recognize",
        title: "أي خطوة تكشف فهمك؟",
        prompt:
          "أنهيت قراءة فقرة. أي تصرّف يختبر قدرتك على استدعائها بصورة أوضح؟",
        options: [
          { id: "reread", label: "أعيد قراءتها حتى تبدو سهلة." },
          { id: "close", label: "أغلقها، أجيب عن سؤال منها، ثم أتحقق." },
          { id: "highlight", label: "ألوّن الجمل التي تبدو مهمة." },
        ],
      },
      {
        id: "review",
        type: "review_creation",
        title: "اجعل لها موعدًا آخر",
        paragraphs: [
          "المحاولة الأولى بداية جيدة. ستُحفظ مراجعة حقيقية لهذا الدرس عند إكماله، ويمكنك تغيير موعدها.",
          "الجدولة الأولى بعد يوم، ثم تتغير وفق تقييمك. هذه قواعد معلنة، وليست توقعًا مضمونًا لما ستتذكره.",
        ],
      },
    ],
  },
  {
    slug: "useful-self-test",
    number: 2,
    version: "1.0.0",
    title: "اصنع اختبارًا مفيدًا",
    english: "Self-testing",
    description: "حوّل معلومة قصيرة إلى سؤال يطلب إجابة من ذاكرتك.",
    duration: "نحو ٦–٩ دقائق",
    color: "sand",
    outcome: "تكتب سؤالًا محددًا تستطيع التحقق من إجابته.",
    requiredQuestionIds: ["prompt-choice", "write-question"],
    steps: [
      {
        id: "welcome",
        type: "explainer",
        title: "السؤال الجيد يطلب شيئًا محددًا",
        paragraphs: [
          "«هل فهمت؟» سؤال صعب التحقق منه. أما «ما وظيفة هذا التركيب؟» فيطلب إجابة محددة يمكنك مقارنتها بمصدر.",
          "مثالنا التعليمي: تشارك الميتوكوندريا في إنتاج معظم جزيئات ATP في كثير من الخلايا حقيقية النواة. وATP جزيء تنقل به الخلية طاقة قابلة للاستخدام في عملياتها.",
          "ابدأ بسؤال واحد لكل فكرة. لا تضع الإجابة كاملة في السؤال. ثم اكتب معيارًا صغيرًا: ما الفكرة الأساسية التي يجب أن تظهر في الإجابة؟",
        ],
        takeaway: "سؤال محدد + إجابة مخفية + معيار تحقق واضح.",
      },
      {
        id: "choice",
        type: "single_choice",
        questionId: "prompt-choice",
        title: "اختر سؤال الاستدعاء",
        prompt: "أي سؤال أفضل لاختبار وظيفة الميتوكوندريا دون تضمين الإجابة؟",
        options: [
          { id: "familiar", label: "هل تبدو لك الميتوكوندريا مألوفة؟" },
          { id: "leading", label: "الميتوكوندريا تنتج ATP، أليس كذلك؟" },
          {
            id: "function",
            label: "ما دور الميتوكوندريا في إمداد الخلية بالطاقة؟",
          },
        ],
      },
      {
        id: "write",
        type: "short_answer_self_check",
        questionId: "write-question",
        title: "الآن اكتب سؤالك",
        prompt:
          "حوّل هذه المعلومة إلى سؤال: «يساعد الغشاء الخلوي في تنظيم مرور المواد بين الخلية وبيئتها».",
        placeholder: "السؤال الذي سأختبر به نفسي…",
        hint: "بعد الحفظ: هل يطلب السؤال وظيفة محددة؟ هل يخفي الإجابة؟ هل يمكن التحقق منها؟ التقييم ذاتي وشفاف.",
      },
      {
        id: "review",
        type: "review_creation",
        title: "من سؤال واحد إلى عادة تعلم",
        paragraphs: [
          "جرّب لاحقًا تطبيق الفكرة على فقرة من مادتك. لا تحتاج إلى تحويل كل كلمة إلى بطاقة.",
          "سننشئ مراجعة قصيرة لمعيار السؤال الجيد. بياناتك الجامعية لا تُرفع تلقائيًا إلى MQW.",
        ],
      },
    ],
  },
  {
    slug: "spaced-practice",
    number: 3,
    version: "1.0.0",
    title: "اترك مسافة للمعلومة",
    english: "Spaced Practice",
    description: "رتّب ما يحتاج مراجعة، وافهم سبب الموعد التالي.",
    duration: "نحو ٥–٨ دقائق",
    color: "rose",
    outcome: "توزع الاستدعاء على أوقات مختلفة وتعدّل مواعيدك بوعي.",
    requiredQuestionIds: ["order", "spacing-choice"],
    steps: [
      {
        id: "welcome",
        type: "explainer",
        title: "المراجعة ليست إعادة القراءة فقط",
        paragraphs: [
          "الممارسة المتباعدة تعني العودة إلى المعلومة في أوقات منفصلة، مع محاولة استدعائها. لا يوجد موعد واحد مثالي لكل معلومة ولكل شخص.",
          "في MQW تبدأ البطاقة بمراجعة بعد يوم. بعد إجابة محفوظة وتقييم صريح: «أحتاج إعادة» تعيد المراجعة قريبًا، و«بصعوبة» تبقي الفاصل قصيرًا، و«تذكرت» توسّعه تدريجيًا. يمكنك تأجيل الموعد بنفسك.",
          "التأخر عن الموعد لا يغير صحة إجابتك ولا يلغي البطاقة. والموعد المقترح أداة تنظيم، وليس حكمًا عليك.",
        ],
        takeaway: "المحاولة الفعلية تحدد النتيجة؛ الموعد ينظم الفرصة التالية.",
      },
      {
        id: "order-step",
        type: "order",
        questionId: "order",
        title: "أي بطاقة تعود أولًا؟",
        prompt:
          "راجعت ثلاث بطاقات في الوقت نفسه. رتّبها من الأكثر حاجة إلى مراجعة قريبة إلى الأقل، بافتراض أن أهميتها متساوية.",
        options: [
          { id: "easy", label: "استدعيت المعلومة بسهولة." },
          { id: "forgot", label: "لم أستطع استدعاء المعلومة." },
          { id: "hard", label: "استدعيتها بصعوبة." },
        ],
        hint: "استخدم سهمي أعلى وأسفل؛ السحب ليس مطلوبًا.",
      },
      {
        id: "spacing",
        type: "single_choice",
        questionId: "spacing-choice",
        title: "وزّع محاولاتك",
        prompt:
          "لديك ثلاث فرص قصيرة خلال أسبوع لتراجع معلومة. أي خطة تطبق التباعد بصورة أوضح؟",
        options: [
          { id: "mass", label: "ثلاث محاولات متتالية في جلسة واحدة فقط." },
          {
            id: "spaced",
            label: "محاولة اليوم، وأخرى في يوم لاحق، وثالثة بعد فاصل آخر.",
          },
          { id: "read", label: "أترك النص مفتوحًا وأقرؤه دون محاولة استدعاء." },
        ],
      },
      {
        id: "review",
        type: "review_creation",
        title: "موعد واضح، وتحكم بيدك",
        paragraphs: [
          "ستجد الموعد الفعلي في صفحة المراجعات بعد إكمال الدرس. يمكنك عرضه وتغييره؛ تغيير الموعد يُحفظ منفصلًا عن محاولات الاستدعاء.",
          "نستخدم جدولًا ثابتًا معلنًا في هذه النسخة. لا نسمّيه ذكاءً اصطناعيًا أو تقديرًا شخصيًا لقوة ذاكرتك.",
        ],
      },
    ],
  },
  {
    slug: "metacognitive-calibration",
    number: 4,
    version: "1.0.0",
    title: "وازن توقعك مع النتيجة",
    english: "Metacognition",
    description: "توقّع نتيجتك، اختبرها، واختر تجربة تعلم صغيرة.",
    duration: "نحو ٦–٩ دقائق",
    color: "lilac",
    outcome: "تفصل شعور الثقة عن نتيجة اختبار محدد.",
    requiredQuestionIds: ["organelle", "membrane"],
    steps: [
      {
        id: "welcome",
        type: "explainer",
        title: "الثقة معلومة… وليست الدرجة",
        paragraphs: [
          "ما وراء المعرفة (Metacognition) يشمل ملاحظة ما تعرفه وما يحتاج تحققًا. سنقارن توقعك بنتيجة سؤالين؛ هذه عينة صغيرة جدًا ولا تصف شخصيتك أو قدرتك العامة.",
          "اقرأ مثال الأحياء: تشارك الميتوكوندريا في إنتاج ATP الذي تستخدمه الخلية في عملياتها. ويساعد الغشاء الخلوي على تنظيم مرور المواد بين الخلية وبيئتها.",
          "المعلومة القصيرة قد يناسبها الاستدعاء. فهم علاقة بين فكرتين يحتاج شرحًا ومثالًا. وحل المسائل يحتاج ممارسة خطوات الحل، وليس حفظ الكلمات وحده.",
        ],
        takeaway: "استخدم النتيجة لتختار خطوة، لا لتضع لنفسك تصنيفًا ثابتًا.",
      },
      {
        id: "predict",
        type: "confidence",
        questionId: "prediction",
        title: "ما توقعك قبل الاختبار؟",
        prompt:
          "من السؤالين التاليين، كم تتوقع أن تجيب عنهما بشكل صحيح؟ هذا اختياري.",
        maximum: 2,
      },
      {
        id: "first",
        type: "single_choice",
        questionId: "organelle",
        title: "السؤال الأول",
        prompt: "أي تركيب يشارك في إنتاج ATP في كثير من الخلايا حقيقية النواة؟",
        options: [
          { id: "mitochondria", label: "الميتوكوندريا" },
          { id: "membrane", label: "الغشاء الخلوي فقط" },
          { id: "nucleus", label: "النواة فقط" },
        ],
      },
      {
        id: "second",
        type: "single_choice",
        questionId: "membrane",
        title: "السؤال الثاني",
        prompt: "ما الوظيفة التي ذكرناها للغشاء الخلوي؟",
        options: [
          { id: "dna", label: "حفظ معظم المادة الوراثية." },
          { id: "regulate", label: "تنظيم مرور المواد بين الخلية وبيئتها." },
          { id: "all-energy", label: "إنتاج كل الطاقة اللازمة للخلية وحده." },
        ],
      },
      {
        id: "review",
        type: "review_creation",
        title: "ماذا تقول التجربة الصغيرة؟",
        paragraphs: [
          "سترى توقعك مقابل النتيجة المحفوظة. سؤالان لا يكفيان لاستنتاج نمط ثابت؛ هذه بداية لتعلم معايرة التوقع.",
          "اختر في دراستك التالية فكرة واحدة، توقع قدرتك على شرحها، ثم اختبر ذلك. يمكنك متابعة النتائج دون أي تحليل نفسي أو AI.",
        ],
      },
    ],
  },
];

export function getLesson(slug: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.slug === slug);
}
export function getRequiredQuestionIds(slug: string): string[] {
  return getLesson(slug)?.requiredQuestionIds ?? [];
}
