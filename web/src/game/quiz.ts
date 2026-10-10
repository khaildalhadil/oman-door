// بنك أسئلة «صح أو خطأ» عن قلعة نزوى.
// يستطيع المعلم تعديل الأسئلة من «لوحة المعلم» داخل اللعبة (تُحفظ في المتصفح ويمكن تصديرها/استيرادها).

export interface Question {
  id: string
  text: string
  answer: boolean
  explain: string
}

export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: 'بُنيت قلعة نزوى في عهد الإمام سلطان بن سيف اليعربي.',
    answer: true,
    explain: 'بُنيت في خمسينيات القرن السابع عشر الميلادي في عهد الإمام سلطان بن سيف اليعربي، ثاني أئمة دولة اليعاربة.',
  },
  {
    id: 'q2',
    text: 'استغرق بناء قلعة نزوى سنة واحدة فقط.',
    answer: false,
    explain: 'استغرق بناء القلعة نحو اثني عشر عاماً.',
  },
  {
    id: 'q3',
    text: 'تقع قلعة نزوى في محافظة مسقط.',
    answer: false,
    explain: 'تقع القلعة في ولاية نزوى بمحافظة الداخلية.',
  },
  {
    id: 'q4',
    text: 'الجزء السفلي من البرج الدائري مُصمت (ممتلئ) ليقاوم قذائف المدافع.',
    answer: true,
    explain: 'صُمّم الجزء السفلي من البرج مُصمتاً لمقاومة قذائف المدافع، ولا يخترقه إلا درج ضيق.',
  },
  {
    id: 'q5',
    text: 'كان المدافعون يصبّون الدبس (عسل التمر) المغلي على المهاجمين من فتحات فوق الأبواب.',
    answer: true,
    explain: 'كانت فوق الأبواب فتحات دفاعية يُصبّ منها الدبس المغلي أو الماء الساخن على المهاجمين.',
  },
  {
    id: 'q6',
    text: 'توجد حول قمة البرج الدائري 24 فتحة لإطلاق المدافع.',
    answer: true,
    explain: 'في أعلى البرج 24 فتحة لإطلاق المدافع، وممر يتسع لنحو 120 حارساً.',
  },
  {
    id: 'q7',
    text: 'الدرج المؤدي إلى أعلى البرج واسع ومستقيم ليسهل الصعود عليه.',
    answer: false,
    explain: 'الدرج ضيق وملتوٍ، وفيه أبواب وفخاخ لإبطاء المهاجمين.',
  },
  {
    id: 'q8',
    text: 'الأفلاج نظام ري عُماني قديم، وبعضها مُدرج في قائمة التراث العالمي لليونسكو.',
    answer: true,
    explain: 'أُدرجت خمسة من أفلاج عُمان في قائمة التراث العالمي عام 2006، ومنها فلج دارس في نزوى.',
  },
  {
    id: 'q9',
    text: 'بُنيت قلعة نزوى في القرن العشرين الميلادي.',
    answer: false,
    explain: 'بُنيت القلعة في القرن السابع عشر الميلادي (حوالي سنة 1650م).',
  },
  {
    id: 'q10',
    text: 'كانت في القلعة آبار تؤمّن الماء للمدافعين أثناء الحصار.',
    answer: true,
    explain: 'بُنيت القلعة فوق مجرى مائي جوفي، فكانت آبارها تؤمّن الماء في أوقات الحصار.',
  },
  {
    id: 'q11',
    text: 'يقع البرج الدائري الكبير في الركن الشمالي الشرقي من القلعة.',
    answer: true,
    explain: 'تتكوّن القلعة من حصن مستطيل تقريباً، والبرج الدائري الكبير في ركنه الشمالي الشرقي.',
  },
  {
    id: 'q12',
    text: 'يوجد بجوار قلعة نزوى سوق تقليدي قديم.',
    answer: true,
    explain: 'سوق نزوى من أقدم أسواق عُمان، ويشتهر بالفخاريات والحلوى العُمانية والفضيات.',
  },
]

const KEY = 'oman3d.questions.v1'

export function loadBank(): Question[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const q = JSON.parse(raw) as Question[]
      if (Array.isArray(q) && q.length && q.every((x) => typeof x.text === 'string' && typeof x.answer === 'boolean'))
        return q
    }
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_QUESTIONS
}

export function saveBank(q: Question[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q))
  } catch {
    /* ignore */
  }
}

export function resetBank() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Pick up to `n` questions in random order for one round. */
export function pickRound(bank: Question[], n = 10) {
  const a = bank.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

export const STATION_COUNT = 10
