import { ref, computed } from 'vue'
import { WEEKLY_STORAGE_KEY } from '../config.js'
import { isoWeek, weekStart } from './chargeModel.js'

/* ═══════════════════════════════════════════════════════════════════════
   НЕДЕЛЬНЫЙ СЛОЙ: ОПРОС, ХРАНЕНИЕ, ЭКСПОРТ

   ── ГДЕ ЖИВУТ ОТВЕТЫ ───────────────────────────────────────────────────
   Бэкенда нет, поэтому ответы ложатся в localStorage телефона. Это НЕ
   мастер контура: мастер — `weekly/weekly_ГГГГ.md`, и он остаётся
   единственным источником истины (CLAUDE.md, «Три сущности»). Приложение
   держит ответы у себя ровно до тех пор, пока они не перенесены в мастер,
   и честно показывает, какие недели ещё не перенесены.

   Порядок, выбранный владельцем 29.08.2026:
     воскресенье → опрос в приложении → кнопка «Экспорт недели» → блок
     уезжает ассистенту → ассистент вносит в weekly_2026.md → пересборка
     генерата → приложение видит неделю уже как «в мастере».

   ⚠ ПОЧЕМУ НЕ ОСТАВИТЬ ВСЁ В localStorage. Он живёт до первой чистки
     браузера, не переезжает между устройствами и невидим для скриптов
     контура — то есть гипотезы Н-1…Н-11 по нему не проверить. А ради них
     недельный слой и заведён.

   ── ЖЁСТКОЕ ПРАВИЛО МАСТЕРА, ПЕРЕНЕСЁННОЕ СЮДА ─────────────────────────
   ⛔ Пропущенная неделя лучше выдуманной. Задним числом опрос заполнить
     нельзя: доступны текущая неделя и предыдущая (пока не наступила среда).
     Дальше форма закрывается, и неделя остаётся дырой в ряду — `health.py`
     её посчитает. Причина в мастере названа прямо: память подгоняет ответ
     под гипотезу, и ряд, заполненный по памяти за три месяца, хуже пустого,
     потому что выглядит настоящим.

   ⛔ Ответ «ничего не было» — ТОЖЕ запись, и у неё есть своя кнопка.
     Молчание и «ничего» — разные факты, и путать их нельзя.
   ═══════════════════════════════════════════════════════════════════════ */

const local = ref(loadLocal())

function loadLocal() {
  try {
    const raw = localStorage.getItem(WEEKLY_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    // Приватный режим, отключённое хранилище, переполнение — приложение
    // обязано работать и без памяти. Опрос в этом случае заполняется и
    // экспортируется, просто не сохраняется между запусками.
    return {}
  }
}

function persist() {
  try {
    localStorage.setItem(WEEKLY_STORAGE_KEY, JSON.stringify(local.value))
  } catch {
    /* см. комментарий выше — молча продолжаем */
  }
}

/* ── АНКЕТА ─────────────────────────────────────────────────────────────
   Шесть шагов. Имена полей — РОВНО из шаблона `weekly/weekly_2026.md`,
   чтобы экспорт ложился в мастер без перевода. Единственное новое поле —
   `who5`: оно считается из пяти вопросов ВОЗ и добавлено в мастер вместе
   с приложением.

   ⚠ ПОЧЕМУ WHO-5, А НЕ «ОЦЕНИ САМОЧУВСТВИЕ ОТ 1 ДО 5».
   Индекс благополучия ВОЗ (WHO-5) — валидированный опросник с известными
   порогами: сумма ×4 даёт шкалу 0–100, ниже 50 — повод присмотреться,
   ниже 28 — повод к разговору со специалистом. Собственная пятибалльная
   шкала таких порогов не имеет, и её движение нечем интерпретировать.
   Лицензия ВОЗ разрешает некоммерческое использование.

   ⛔ Опрос НЕ содержит вопросов, по которым можно поставить психиатрический
     диагноз, и приложение его не ставит: WHO-5 — скрининг самочувствия, а
     не диагностика. При низком балле экран говорит только «стоит показать
     это врачу», как и везде в контуре. */
export const SURVEY = [
  {
    id: 'who5',
    title: 'Самочувствие',
    intro: 'За прошедшую неделю…',
    note: 'Индекс благополучия ВОЗ (WHO-5). Пять утверждений, одна шкала.',
    scale: [
      { v: 0, label: 'никогда' },
      { v: 1, label: 'изредка' },
      { v: 2, label: 'меньше половины времени' },
      { v: 3, label: 'больше половины времени' },
      { v: 4, label: 'большую часть времени' },
      { v: 5, label: 'всё время' },
    ],
    items: [
      { key: 'who5_1', text: 'Я чувствовал себя жизнерадостным и в хорошем настроении' },
      { key: 'who5_2', text: 'Я чувствовал себя спокойным и расслабленным' },
      { key: 'who5_3', text: 'Я чувствовал себя активным и бодрым' },
      { key: 'who5_4', text: 'Я просыпался, чувствуя себя свежим и отдохнувшим' },
      { key: 'who5_5', text: 'Моя повседневная жизнь была наполнена интересными для меня делами' },
    ],
  },
  {
    id: 'joints',
    title: 'Суставы',
    intro: 'Максимум за неделю, а не «в среднем»',
    note: 'Ведущая линия контура: подагра и то, чем её глушат.',
    items: [
      { key: 'pain_heel', text: 'Боль в левой пятке', kind: 'nrs' },
      { key: 'pain_ankle', text: 'Боль в левом голеностопе', kind: 'nrs' },
      {
        key: 'flare',
        text: 'Был настоящий приступ?',
        hint: 'Острая боль + отёк + краснота. Не «ныло», а приступ.',
        kind: 'choice',
        options: [{ v: 'no', label: 'нет' }, { v: 'yes', label: 'да' }],
      },
      {
        key: 'arcoxia',
        text: 'Дней приёма аркоксии / НПВС',
        hint: 'Цель контура — меньше 30 дней в год. Сейчас выходит около 120.',
        kind: 'count7',
      },
    ],
  },
  {
    id: 'gut',
    title: 'ЖКТ',
    intro: 'Пятнадцать лет ИПП — самая длинная терапия контура',
    items: [
      {
        key: 'heartburn',
        text: 'Изжога или жжение за грудиной',
        kind: 'choice',
        options: [
          { v: 0, label: 'нет' },
          { v: 1, label: 'редко' },
          { v: 2, label: 'несколько раз' },
          { v: 3, label: 'почти каждый день' },
        ],
      },
      {
        key: 'gut',
        text: 'Живот',
        kind: 'choice',
        options: [
          { v: 'ok', label: 'норма' },
          { v: 'bloat', label: 'вздутие' },
          { v: 'loose', label: 'жидкий' },
          { v: 'hard', label: 'запор' },
        ],
      },
    ],
  },
  {
    id: 'exposure',
    title: 'Экспозиция',
    intro: 'То, что можно поменять руками',
    note: 'Здесь проверяются гипотезы Н-1…Н-5: алкоголь, вода, холод, пурины.',
    items: [
      { key: 'alcohol', text: 'Порций алкоголя за неделю', hint: '1 порция = 0,5 пива / 150 мл вина / 50 мл крепкого. Цель — не больше 3.', kind: 'number', max: 40 },
      { key: 'cigs', text: 'Сигарет за неделю', kind: 'number', max: 200 },
      { key: 'meat', text: 'Дней с красным мясом, субпродуктами, морепродуктами', kind: 'count7' },
      { key: 'water_l', text: 'Литров воды в день, в среднем', hint: 'Назначение — 30 мл/кг, при текущем весе около 3,2 л.', kind: 'decimal', max: 8 },
      { key: 'sleep_h', text: 'Часов сна за ночь, в среднем', kind: 'decimal', max: 14 },
      { key: 'cold', text: 'Дней с холодом (моржевание, холодный душ)', hint: 'Загадка моржевания — гипотеза Н-1: «в это время подагра не тревожила».', kind: 'count7' },
      { key: 'alkaline', text: 'Пил щелочную воду (боржоми)?', kind: 'choice', options: [{ v: 'no', label: 'нет' }, { v: 'yes', label: 'да' }] },
    ],
  },
  {
    id: 'current',
    title: 'Что идёт сейчас',
    intro: 'Процессы, которые меняются за недели, а не за годы',
    items: [
      { key: 'prostate', text: 'Дискомфорт в промежности', kind: 'nrs' },
      {
        key: 'urinary',
        text: 'Мочеиспускание',
        kind: 'choice',
        options: [
          { v: 'ok', label: 'норма' },
          { v: 'freq', label: 'учащено' },
          { v: 'hard', label: 'затруднено' },
          { v: 'night', label: 'ночные подъёмы' },
        ],
      },
      {
        key: 'skin_face',
        text: 'Лицо: брови и крылья носа',
        kind: 'choice',
        options: [
          { v: 0, label: 'чисто' },
          { v: 1, label: 'лёгкое шелушение' },
          { v: 2, label: 'выражено' },
          { v: 3, label: 'краснота и зуд' },
        ],
      },
      { key: 'cinovit', text: 'Применений Циновита за неделю', kind: 'count7' },
      { key: 'focus', text: 'Способность начинать и удерживать задачи', hint: '1 — не мог начать ничего, 5 — всё шло как надо.', kind: 'scale5' },
    ],
  },
  {
    id: 'events',
    title: 'События',
    intro: 'Визиты, анализы, болезни, поездки, стресс — что угодно значимое',
    note: '⛔ «Ничего не было» — тоже запись. Кнопка ниже ставит именно её, а не пустоту.',
    items: [
      { key: 'weight', text: 'Вес, кг (если взвешивались)', kind: 'decimal', max: 200, optional: true },
      { key: 'bp', text: 'Типичное давление за неделю', hint: 'Формат 139/86. Ряд оборвался в апреле 2019 — любая точка ценна.', kind: 'text', optional: true },
      { key: 'events', text: 'Что было', kind: 'textarea', optional: true },
    ],
  },
]

/** Минимальный набор — тридцать секунд, если совсем некогда (правило мастера). */
export const MINIMUM_KEYS = ['pain_heel', 'flare', 'heartburn', 'arcoxia', 'alcohol', 'who5']

export function useWeekly(masterWeeks) {
  const currentWeek = computed(() => isoWeek(new Date()))

  /** Недели, доступные для заполнения: текущая и (до среды) предыдущая. */
  const editableWeeks = computed(() => {
    const now = new Date()
    const out = [currentWeek.value]
    const dow = now.getDay() === 0 ? 7 : now.getDay() // пн=1 … вс=7
    if (dow <= 3) {
      const prev = new Date(now.getTime() - 7 * 86400000)
      out.push(isoWeek(prev))
    }
    return out
  })

  /**
   * Сводный список недель: мастер + локальные черновики.
   * Мастер всегда главнее — если неделя есть в обоих, показывается мастер,
   * а локальная копия помечается как уже перенесённая.
   */
  const weeks = computed(() => {
    const byCode = new Map()
    for (const w of masterWeeks.value || []) {
      byCode.set(w.week, { ...w, source: 'master' })
    }
    for (const [code, fields] of Object.entries(local.value)) {
      if (byCode.has(code)) {
        byCode.get(code).hasLocalCopy = true
      } else {
        byCode.set(code, { week: code, fields, source: 'local' })
      }
    }
    return [...byCode.values()].sort((a, b) => (a.week < b.week ? 1 : -1))
  })

  /** Недели, заполненные в приложении, но ещё не внесённые в мастер. */
  const pendingExport = computed(() =>
    weeks.value.filter((w) => w.source === 'local'),
  )

  const latest = computed(() => weeks.value[0] || null)

  function get(code) {
    const inMaster = (masterWeeks.value || []).find((w) => w.week === code)
    if (local.value[code]) return { week: code, fields: local.value[code], source: 'local' }
    return inMaster ? { ...inMaster, source: 'master' } : null
  }

  function save(code, fields) {
    // WHO-5: пять утверждений → индекс 0–100 и производные wellbeing/energy.
    //
    // ⚠ wellbeing и energy НЕ спрашиваются отдельно, а выводятся из WHO-5.
    //   Спрашивать про самочувствие дважды разными словами — верный способ
    //   получить два несогласованных ответа и не знать, какому верить.
    const items = ['who5_1', 'who5_2', 'who5_3', 'who5_4', 'who5_5']
    const answered = items.filter((k) => Number.isFinite(fields[k]))
    const out = { ...fields }
    if (answered.length === items.length) {
      const sum = items.reduce((a, k) => a + fields[k], 0)
      out.who5 = sum * 4                                    // 0–100
      out.wellbeing = Math.round(1 + (sum / 25) * 4)        // 1–5, для рядов мастера
      out.energy = Math.max(1, Math.round(1 + (fields.who5_3 / 5) * 4))
    }
    for (const k of items) delete out[k]

    // Пустые значения не сохраняем: пропуск поля и «ноль» — разные факты.
    for (const [k, v] of Object.entries(out)) {
      if (v === '' || v === null || v === undefined) delete out[k]
    }

    local.value = { ...local.value, [code]: out }
    persist()
  }

  function drop(code) {
    const next = { ...local.value }
    delete next[code]
    local.value = next
    persist()
  }

  return {
    weeks, latest, pendingExport, currentWeek, editableWeeks,
    localAnswers: local, get, save, drop,
  }
}

/* ── ЭКСПОРТ ────────────────────────────────────────────────────────────
   Собирает блок ровно того вида, что лежит в `weekly/weekly_ГГГГ.md`,
   чтобы его можно было вставить в мастер без правки. Порядок полей — как
   в шаблоне мастера; поля, которых нет, пропускаются (пропуск и ноль —
   разные факты). */
const FIELD_ORDER = [
  'pain_heel', 'pain_ankle', 'pain_other', 'flare',
  'heartburn', 'gut',
  'who5', 'wellbeing', 'energy', 'focus', 'sleep_h',
  'nexium', 'telpres', 'arcoxia', 'other_meds', 'supplements',
  'alcohol', 'cigs', 'water_l', 'alkaline', 'meat', 'sweet_drinks',
  'yoga', 'walk', 'swim', 'kettlebell', 'cold',
  'weight', 'bp',
  'prostate', 'urinary', 'skin_face', 'skin_itch', 'cinovit',
  'events',
]

function fmtValue(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v).replace('.', '.')
  const s = String(v)
  // Строки в мастере в кавычках, кроме коротких кодовых значений шкал.
  if (['no', 'yes', 'ok', 'bloat', 'loose', 'hard', 'freq', 'night'].includes(s)) return s
  return `"${s.replace(/"/g, "'")}"`
}

export function exportWeek(code, fields, meta = {}) {
  const entries = FIELD_ORDER
    .filter((k) => fields[k] !== undefined && fields[k] !== null && fields[k] !== '')
    .map((k) => `${k}: ${fmtValue(fields[k])}`)

  // Поля, которых нет в известном порядке, всё равно выносим — иначе новое
  // поле молча пропало бы при экспорте, а это ровно та ошибка, от которой
  // заведён словарь показателей (Д-4).
  for (const [k, v] of Object.entries(fields)) {
    if (!FIELD_ORDER.includes(k) && v !== undefined && v !== null && v !== '') {
      entries.push(`${k}: ${fmtValue(v)}`)
    }
  }

  const head = `${code}: {`
  const body = entries.join(', ')
  const stamp = new Date().toISOString().slice(0, 10)

  const lines = [
    `# Недельная отметка из приложения «Контур», выгружена ${stamp}`,
  ]
  if (meta.charge !== undefined && meta.charge !== null) {
    lines.push(`# Заряд на момент выгрузки: ${meta.charge} · метод ${meta.method}`)
  }
  lines.push(`${head}${body}}`)
  lines.push('')
  lines.push('# ⛔ Вставить в weekly/weekly_2026.md, раздел «Недели», СНИЗУ.')
  lines.push('# После внесения: python3 tools/run_all.py && python3 tools/build_app_data.py')
  return lines.join('\n')
}

/** Дата воскресенья указанной недели — для подписи «отметка за 30 августа». */
export function weekSunday(code) {
  const start = weekStart(code)
  return start ? new Date(start.getTime() + 6 * 86400000) : null
}

export function fmtWeekRange(code) {
  const start = weekStart(code)
  if (!start) return code
  const end = new Date(start.getTime() + 6 * 86400000)
  const f = (d) => `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  return `${f(start)} — ${f(end)}`
}
