/* ═══════════════════════════════════════════════════════════════════════
   «ЗАРЯД» — композитный балл 0–100

   Аналог Garmin Body Battery по метафоре, но не по устройству. Body Battery
   считается по непрерывной телеметрии (ВСР, сон, шаги) и отвечает на вопрос
   «сколько у тебя сил прямо сейчас». Здесь телеметрии нет и не будет, а
   вопрос другой: «насколько тело под нагрузкой и насколько контур это видит».

   ⛔ ЧЕМ ЗАРЯД НЕ ЯВЛЯЕТСЯ. Это не оценка здоровья, не прогноз и не диагноз.
   Это агрегат того, что УЖЕ записано в мастерах контура: отклонения от личных
   целей, направление рядов, симптомы недели и лекарственная нагрузка. Число
   не добавляет к данным ничего нового — оно только собирает их в одну шкалу,
   чтобы падение было заметно раньше, чем его заметит человек.

   ── ЧТО ДЕЛАЕТ КОМПОЗИТНЫЙ БАЛЛ ЧЕСТНЫМ, А НЕ ИГРУШКОЙ ─────────────────
   Разбор Whoop Recovery, InsideTracker InnerAge и Body Battery даёт четыре
   свойства, без которых балл читается как гадание, и все четыре здесь есть:

     1. Названы компоненты И ВЕСА. Они ниже, в WEIGHTS, открытым текстом.
        (Главная претензия к Whoop — веса не публикуются.)
     2. Балл разбирается на слагаемые в один тап. `breakdown` возвращает,
        сколько пунктов съел каждый компонент, — экран «Из чего сложился».
     3. Заявлена дельта, ниже которой изменение не считается изменением.
        MIN_DELTA = 4. Меньше — печатается «без изменений», а не «−2».
     4. Рядом с баллом всегда стоит полнота входных данных. Function Health
        осознанно НЕ даёт единого балла именно потому, что не хочет обещать
        точность, которой нет. Здесь балл есть, но при низкой полноте он
        показывается диапазоном или не показывается вовсе.

   ── ПОЧЕМУ ВЕСА ИМЕННО ТАКИЕ ───────────────────────────────────────────
   Сумма 90, а не 100, — чтобы у полностью здоровой картины оставался
   потолок: 100 означало бы «в порядке всё, включая то, что не измерено».
   Внутри: 45 на состояние шести систем, 15 на направление рядов, 20 на
   симптомы недели, 10 на лекарственную и бытовую экспозицию.

   Половина веса отдана недельному слою и экспозиции (30 из 90) намеренно.
   Лабораторный слой обновляется раз в полгода-год: между заборами он не
   двигается вовсе, и балл, построенный на нём одном, был бы константой с
   двумя ступеньками в год. Недельный слой — то, что меняется и на что можно
   влиять; это единственная часть шкалы, которая отвечает на действия.

   ── ЧТО ПРОИСХОДИТ, КОГДА ДАННЫХ МАЛО ──────────────────────────────────
   Компонент без данных ИСКЛЮЧАЕТСЯ, а оставшиеся веса ренормируются. Балл
   при этом не падает — падает `confidence`, и падает ровно то, что должно:
   уверенность, а не оценка. Обратный порядок («нет данных → минус баллы»)
   был бы враньём: непроверенный показатель не делает тело хуже, он делает
   картину слепее.

   ⚠ ИСКЛЮЧЕНИЕ ИЗ ПРЕДЫДУЩЕГО ПРАВИЛА — КАНОН Р-6 (risk/00-RISK.md):
   «отсутствие данных — тоже риск, и он считается». Оно не противоречит:
   ненайденный показатель ВНУТРИ системы поднимает тяжесть этой системы
   (слагаемое `unknown`), потому что при 15 годах ИПП неизмеренный B12 —
   это не «неизвестно», а «пятнадцать лет никто не смотрел». А целый
   компонент без единого входа (например, симптомы, когда неделя не
   заполнена) выпадает из расчёта, потому что о нём нельзя сказать вообще
   ничего — ни хорошего, ни плохого.

   ⛔ ЗАМОК ЗАКРЫТОГО ПЕРИОДА (CLAUDE.md, прогнозный контур). Показанное
   владельцу число задним числом не пересчитывается. Смена метода — это
   новая версия, а не правка старой; поэтому у модели есть METHOD_VERSION,
   и она уезжает в экспорт вместе с числом.
   ═══════════════════════════════════════════════════════════════════════ */

export const METHOD_VERSION = '1.0 (2026-08-29)'

/** Веса слагаемых. Сумма = 90. Меняешь — поднимай METHOD_VERSION. */
export const WEIGHTS = {
  CVD: 10,   // сердце и сосуды: Lp(a) 170 + ЛПНП с пятилетним ростом + ГБ II ст.
  KID: 9,    // почки: «тройной удар» БРА + тиазид + НПВС, ХБП С2 без наблюдения
  LIV: 7,    // печень: жировая болезнь по УЗИ, ферменты пока в норме
  GIT: 7,    // ЖКТ: 15 лет ИПП без проверки последствий
  JNT: 7,    // суставы и обмен: подагра без базисной терапии
  NEU: 5,    // мозг и нервная система: дефициты, не измеренные ни разу
  trend: 15, // направление рядов: показатель уходит ОТ цели
  symptoms: 20, // недельный слой: боль, ЖКТ, самочувствие
  exposure: 10, // экспозиция: НПВС, алкоголь, курение, пропуски приёма
}
const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0) // 90

/** Дельта, ниже которой изменение не объявляется изменением. */
export const MIN_DELTA = 4

/** Пороги показа. Ниже LOW число не печатается вовсе. */
export const CONF_EXACT = 0.65
export const CONF_LOW = 0.30

/* ── тяжесть одной системы ──────────────────────────────────────────────
   Три слагаемых, и каждое отвечает на свой вопрос стандарта полноты
   (docs/STANDARD-completeness.md §1):

     off      — «сколько из измеренного вне личной цели»    вес 0.55
     unknown  — «сколько ключевого не измерялось ни разу»    вес 0.30
     stale    — «насколько то, что есть, описывает прошлое»  вес 0.15

   ⚠ `off` считается только по маркёрам, у которых цель ЕСТЬ в
   forecast/targets.md. Маркёр без цели в этом слагаемом не участвует:
   сравнивать его не с чем, и придумывать порог на месте — ровно тот способ
   соврать себе, от которого заведён реестр целей.

   ⚠ `unknown` считается только по маркёрам приоритета 🔴 и 🟠 из реестра
   интервалов. Иначе любая система, где не сдан десяток второстепенных
   позиций, светилась бы красным навсегда, а по канону Р-5 пустая тревога
   дороже, чем кажется: после трёх пустых четвёртую проигнорируют. */
function systemSeverity(system) {
  const withTarget = system.markers.filter((m) => m.off_target !== null)
  const off = withTarget.length
    ? withTarget.filter((m) => m.off_target === true).length / withTarget.length
    : null

  // ⛔ Маркёр со статусом `blocked` (тест на текущей терапии ложноотрицателен)
  //    НЕ считается неизвестностью. Он не «не сдан по забывчивости» — его
  //    нельзя сдавать самовольно, и вина за него лежит не на владельце.
  const key = system.markers.filter(
    (m) => ['🔴', '🟠'].includes(m.priority) && m.status !== 'blocked' && m.status !== 'once',
  )
  const unknown = key.length ? key.filter((m) => m.status === 'gap').length / key.length : null

  const withData = system.markers.filter((m) => m.points > 0 && m.status !== 'once')
  const stale = withData.length
    ? withData.filter((m) => m.status === 'stale').length / withData.length
    : null

  // Ренормировка внутри системы: слагаемое, которое нечем посчитать,
  // не тянет тяжесть вниз к нулю — оно просто не участвует.
  const parts = [
    [off, 0.55],
    [unknown, 0.30],
    [stale, 0.15],
  ].filter(([v]) => v !== null)
  if (!parts.length) return { severity: null, off, unknown, stale }

  const wsum = parts.reduce((a, [, w]) => a + w, 0)
  const severity = parts.reduce((a, [v, w]) => a + v * w, 0) / wsum
  return { severity, off, unknown, stale }
}

/** Светофор системы. Пять ступеней — см. комментарий у токенов в main.css. */
export function systemLight(system) {
  const { severity, unknown } = systemSeverity(system)
  if (severity === null) return 'unknown'
  // Ключевая неизвестность поднимает систему в красное сама по себе (Р-6):
  // «не измерялось» ≠ «в порядке».
  if (severity >= 0.5 || (unknown !== null && unknown >= 0.5)) return 'alarm'
  if (severity >= 0.2) return 'watch'
  return 'ok'
}

/* ── направление рядов ──────────────────────────────────────────────────
   ⛔ Наклон при менее чем трёх точках не считается вовсе (Д-5) — генератор
   в этом случае кладёт `slope_per_year: null`, и такой маркёр сюда не
   доходит. Соблазн экстраполировать по двум замерам — главный способ
   соврать себе, и он закрыт на уровне данных, а не на уровне интерфейса. */
function trendSeverity(systems) {
  const away = []
  const toward = []
  for (const s of systems) {
    for (const m of s.markers) {
      if (m.direction === 'away') away.push({ ...m, system: s.code })
      else if (m.direction === 'to') toward.push({ ...m, system: s.code })
    }
  }
  if (!away.length && !toward.length) return { severity: null, away, toward }
  // Три пункта штрафа за каждый уходящий ряд, потолок — весь компонент.
  const severity = Math.min(1, (away.length * 3) / WEIGHTS.trend)
  return { severity, away, toward }
}

/* ── недельный слой ─────────────────────────────────────────────────────
   Поля — те же, что в шаблоне weekly/weekly_2026.md. Опрос приложения
   заполняет ровно их, чтобы экспорт ложился в мастер без перевода. */
function num(v, fallback = null) {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
  return Number.isFinite(n) ? n : fallback
}

function symptomSeverity(week) {
  if (!week) return { severity: null, parts: [] }
  const f = week.fields || {}
  const parts = []

  const pains = [num(f.pain_heel), num(f.pain_ankle), num(f.prostate)].filter((v) => v !== null)
  if (pains.length) {
    parts.push({ key: 'pain', label: 'боль', share: 0.4, value: Math.max(...pains) / 10 })
  }
  if (num(f.heartburn) !== null) {
    parts.push({ key: 'gut', label: 'изжога и живот', share: 0.3, value: num(f.heartburn) / 3 })
  }
  const state = [num(f.wellbeing), num(f.energy)].filter((v) => v !== null)
  if (state.length) {
    const avg = state.reduce((a, b) => a + b, 0) / state.length
    parts.push({ key: 'state', label: 'самочувствие', share: 0.3, value: (5 - avg) / 4 })
  }
  if (!parts.length) return { severity: null, parts: [] }

  const wsum = parts.reduce((a, p) => a + p.share, 0)
  let severity = parts.reduce((a, p) => a + Math.min(1, Math.max(0, p.value)) * p.share, 0) / wsum

  // ⚠ Настоящий приступ — не среднее. Острая боль с отёком и краснотой
  //    означает, что подагра сейчас не контролируется, и усреднять её с
  //    хорошим сном нельзя: неделя с приступом не бывает спокойной неделей.
  if (String(f.flare).toLowerCase() === 'yes') severity = Math.max(severity, 0.75)

  return { severity, parts, flare: String(f.flare).toLowerCase() === 'yes' }
}

function exposureSeverity(week) {
  if (!week) return { severity: null, parts: [] }
  const f = week.fields || {}
  const parts = []

  // Аркоксия: поле мастера — таблеток за неделю, приём 1 таб/сут, то есть
  // это же и число дней. Потолок 7 = НПВС всю неделю.
  if (num(f.arcoxia) !== null) {
    parts.push({ key: 'nsaid', label: 'НПВС', share: 0.5, value: num(f.arcoxia) / 7 })
  }
  if (num(f.alcohol) !== null) {
    // Цель контура — ≤3 порций в неделю (forecast/targets.md §6).
    // Потолок штрафа — вдвое больше цели.
    parts.push({ key: 'alcohol', label: 'алкоголь', share: 0.2, value: num(f.alcohol) / 6 })
  }
  if (num(f.cigs) !== null) {
    // Факт на 27.08.2026 — ~35 сигарет в неделю. Цель — 0.
    parts.push({ key: 'cigs', label: 'курение', share: 0.2, value: num(f.cigs) / 49 })
  }
  if (num(f.meat) !== null) {
    parts.push({ key: 'meat', label: 'пуриновая еда', share: 0.1, value: num(f.meat) / 7 })
  }
  if (!parts.length) return { severity: null, parts: [] }

  const wsum = parts.reduce((a, p) => a + p.share, 0)
  const severity = parts.reduce((a, p) => a + Math.min(1, Math.max(0, p.value)) * p.share, 0) / wsum
  return { severity, parts }
}

/* ── полнота входных данных ─────────────────────────────────────────────
   Отдельное число, а не поправка к баллу. Отвечает на вопрос «насколько
   контур вообще видит», и именно оно решает, показывать балл числом,
   диапазоном или не показывать. */
function coverage(data, week, weekAgeDays) {
  const keyMarkers = []
  for (const s of data.systems) {
    for (const m of s.markers) {
      if (['🔴', '🟠'].includes(m.priority) && m.status !== 'blocked') keyMarkers.push(m)
    }
  }
  const lab = keyMarkers.length
    ? keyMarkers.reduce((a, m) => a + (m.fresh || 0), 0) / keyMarkers.length
    : 0

  // Неделя: свежая — полный вес, до трёх недель — половина, дальше — ноль.
  let wk = 0
  if (week && weekAgeDays !== null) {
    if (weekAgeDays <= 10) wk = 1
    else if (weekAgeDays <= 21) wk = 0.5
  }
  return { lab, week: wk, total: 0.65 * lab + 0.35 * wk }
}

/** ISO-номер недели: '2026-W35'. Понедельник — первый день. */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const n = Math.ceil(((d - start) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(n).padStart(2, '0')}`
}

/** Понедельник недели '2026-W35' как Date (для возраста записи). */
export function weekStart(code) {
  const m = /^(\d{4})-W(\d{2})$/.exec(code)
  if (!m) return null
  const simple = new Date(Date.UTC(+m[1], 0, 1 + (+m[2] - 1) * 7))
  const dow = simple.getUTCDay() || 7
  simple.setUTCDate(simple.getUTCDate() - dow + 1)
  return simple
}

/**
 * Главный расчёт.
 * @param {object} data   содержимое public/data/health.json
 * @param {object} week   недельная запись {week, fields} или null
 * @param {Date}   now    точка отсчёта (для тестов и для пересчёта прошлых недель)
 */
export function computeCharge(data, week, now = new Date()) {
  const parts = []

  for (const s of data.systems) {
    const { severity, off, unknown, stale } = systemSeverity(s)
    parts.push({
      key: s.code,
      label: s.short,
      full: s.name,
      weight: WEIGHTS[s.code] ?? 0,
      severity,
      detail: { off, unknown, stale },
      kind: 'system',
    })
  }

  const tr = trendSeverity(data.systems)
  parts.push({
    key: 'trend',
    label: 'Направление рядов',
    full: 'Показатели, уходящие от цели',
    weight: WEIGHTS.trend,
    severity: tr.severity,
    detail: { away: tr.away, toward: tr.toward },
    kind: 'trend',
  })

  const weekAgeDays = week && weekStart(week.week)
    ? Math.floor((now - weekStart(week.week)) / 86400000)
    : null

  const sy = symptomSeverity(week)
  parts.push({
    key: 'symptoms',
    label: 'Симптомы недели',
    full: 'Боль, ЖКТ, самочувствие за неделю',
    weight: WEIGHTS.symptoms,
    severity: sy.severity,
    detail: sy,
    kind: 'weekly',
  })

  const ex = exposureSeverity(week)
  parts.push({
    key: 'exposure',
    label: 'Экспозиция',
    full: 'НПВС, алкоголь, курение, пуриновая еда',
    weight: WEIGHTS.exposure,
    severity: ex.severity,
    detail: ex,
    kind: 'weekly',
  })

  const available = parts.filter((p) => p.severity !== null)
  const availableWeight = available.reduce((a, p) => a + p.weight, 0)

  const cov = coverage(data, week, weekAgeDays)

  if (!availableWeight) {
    return {
      value: null, low: null, high: null, mode: 'blind',
      confidence: 0, coverage: cov, parts, method: METHOD_VERSION,
      missing: missingInputs(data, week),
    }
  }

  // Ренормировка: тяжесть считается по доступным компонентам и разворачивается
  // обратно на полную шкалу 90. Компонент без данных не «ноль тяжести»,
  // он просто не голосует.
  const rawPenalty = available.reduce((a, p) => a + p.weight * p.severity, 0)
  const penalty = (rawPenalty / availableWeight) * TOTAL_WEIGHT
  const value = Math.max(0, Math.min(100, Math.round(100 - penalty)))

  // Ширина диапазона растёт по мере падения полноты: от ±3 при полной
  // картине до ±12 у самого порога, ниже которого число не печатается.
  const span = Math.round(3 + (1 - Math.min(1, cov.total / CONF_EXACT)) * 9)

  let mode = 'exact'
  if (cov.total < CONF_LOW) mode = 'blind'
  else if (cov.total < CONF_EXACT) mode = 'range'

  return {
    value,
    low: Math.max(0, value - span),
    high: Math.min(100, value + span),
    mode,
    confidence: cov.total,
    coverage: cov,
    parts: parts.map((p) => ({
      ...p,
      // Сколько пунктов из ста съел этот компонент — для экрана «Из чего сложился».
      points: p.severity === null
        ? null
        : Math.round((p.weight * p.severity / availableWeight) * TOTAL_WEIGHT * 10) / 10,
    })),
    availableWeight,
    totalWeight: TOTAL_WEIGHT,
    weekAgeDays,
    method: METHOD_VERSION,
    missing: missingInputs(data, week),
  }
}

/**
 * Чего не хватает, чтобы контур перестал быть слепым. Три позиции, отсортированные
 * по тому, сколько веса они вернут в расчёт.
 *
 * ⚠ Не «что делать» — «чего нет». Разница принципиальна: контур не назначает
 *   обследований (см. docs/STANDARD-safety.md), он называет пробел. Что с ним
 *   делать, решает план обследования и врач.
 */
export function missingInputs(data, week) {
  const out = []

  if (!week) {
    out.push({
      kind: 'week',
      title: 'Недельная отметка не заполнена',
      why: 'Тридцать пунктов из девяноста — симптомы и экспозиция. Без недели они не считаются.',
      gain: WEIGHTS.symptoms + WEIGHTS.exposure,
    })
  }

  // Самые дорогие лабораторные пробелы: приоритет 🔴, ни одной точки.
  const gaps = []
  const seen = new Set()
  for (const s of data.systems) {
    for (const m of s.markers) {
      if (m.status !== 'gap' || m.priority !== '🔴' || seen.has(m.key)) continue
      seen.add(m.key)
      gaps.push({
        kind: 'marker',
        key: m.key,
        title: m.name,
        why: m.why_interval || 'ни одной точки за всё время',
        system: s.short,
        gain: WEIGHTS[s.code] ?? 0,
      })
    }
  }
  gaps.sort((a, b) => b.gain - a.gain)
  out.push(...gaps)

  // Устаревшая картина целиком — отдельной строкой, если последнему забору
  // больше полутора лет (порог доверия из risk/00-RISK.md).
  if (data.last_draw) {
    const age = Math.floor((Date.now() - new Date(data.last_draw)) / 86400000)
    if (age > 540) {
      out.unshift({
        kind: 'draw',
        title: `Последний забор ${age} дней назад`,
        why: 'Данным старше 18 месяцев доверие снижается, старше 36 — картина считается неактуальной.',
        gain: 45,
      })
    }
  }
  return out
}

/** Ряд «Заряда» по неделям — для графика в «Прогрессе». */
export function chargeSeries(data, weeks, now = new Date()) {
  return weeks
    .map((w) => {
      const start = weekStart(w.week)
      const at = start ? new Date(start.getTime() + 6 * 86400000) : now
      const r = computeCharge(data, w, at > now ? now : at)
      return { week: w.week, value: r.value, mode: r.mode, confidence: r.confidence }
    })
    .filter((p) => p.value !== null)
}

/** Подпись к изменению. Дельта меньше MIN_DELTA изменением не считается. */
export function deltaLabel(current, previous) {
  if (current === null || previous === null || previous === undefined) return null
  const d = current - previous
  if (Math.abs(d) < MIN_DELTA) return { text: 'без изменений', dir: 'flat', value: d }
  return { text: `${d > 0 ? '+' : '−'}${Math.abs(d)}`, dir: d > 0 ? 'up' : 'down', value: d }
}
