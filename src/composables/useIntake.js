import { ref, computed } from 'vue'
import { INTAKE_STORAGE_KEY } from '../config.js'

/* ═══════════════════════════════════════════════════════════════════════
   ХИМИЧЕСКИЙ СЛОЙ: ОТМЕТКА ДНЯ, ХРАНЕНИЕ, ЭКСПОРТ  (SYS-10, Д-33)

   ── УЧЁТ ПО ДЕЛЬТЕ, А НЕ ДНЕВНИК ───────────────────────────────────────
   Обычный день разворачивается генератором из meds/meds_master.md §1 и
   приезжает сюда готовым (`data.chemistry.plan`). Руками отмечается только
   отклонение: пропуск планового · внеплановый приём · носитель · заметка.

   ⛔ Экран не спрашивает «что вы принимали сегодня». Ежедневный дневник
     владелец вести не будет — он сказал это прямо, — и слой, который его
     требует, умирает на второй неделе, унося собранное.

   ⛔ День без отметки — это «шло по схеме», а не пропущенный ввод. Поэтому
     здесь, в отличие от недельного опроса, нет ни баннера «пора отметить»,
     ни счётчика пропусков: нечего пропускать.

   ── ГДЕ ЖИВУТ ОТМЕТКИ ──────────────────────────────────────────────────
   Как и у недельного слоя: localStorage телефона до переноса в мастер.
   Мастер — meds/intake_2026.md, и он единственный источник истины. Экран
   честно показывает, какие дни ещё не перенесены: отметка, оставшаяся в
   телефоне, для контура не существует.
   ═══════════════════════════════════════════════════════════════════════ */

/** Четыре носителя. Словарь закрыт и повторяет §1 мастера — пятый заводится
 *  решением владельца с номером Д-NN, а не правкой этого файла. */
export const CARRIERS = [
  { id: 'алкоголь', label: 'Алкоголь', hint: 'любая доза' },
  { id: 'кофеин', label: 'Кофеин сверх обычного', hint: 'вторая чашка и дальше, энергетики' },
  { id: 'пурины', label: 'Пурины, застолье', hint: 'мясо, субпродукты, морепродукты' },
  { id: 'фруктоза', label: 'Сладкое, соки', hint: 'фруктоза' },
]

const local = ref(loadLocal())

function loadLocal() {
  try {
    const raw = localStorage.getItem(INTAKE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    // Приватный режим, отключённое хранилище, переполнение: отметку можно
    // заполнить и выгрузить, она просто не переживёт перезапуск.
    return {}
  }
}

function persist() {
  try {
    localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(local.value))
  } catch {
    /* см. выше — молча продолжаем */
  }
}

export function isoDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function fmtDay(code) {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(code || '')
  return m ? `${m[3]}.${m[2]}` : code
}

/** Есть ли в отметке хоть что-нибудь. Пустая отметка не сохраняется: «ничего
 *  не отклонилось» — это отсутствие записи, а не запись с нулями. */
export function isEmpty(entry) {
  if (!entry) return true
  return !(entry.carriers?.length || entry.skips?.length
           || (entry.extra || '').trim() || (entry.note || '').trim())
}

export function useIntake(masterEvents) {
  const today = computed(() => isoDate())

  /** Дни, доступные для отметки: сегодня и вчера.
   *
   *  ⛔ Дальше двух дней форма не пускает — то же правило, что в недельном
   *    опросе: память подгоняет ответ под гипотезу, и «кажется, в среду было
   *    вино» портит ряд сильнее, чем пустая среда. Что было раньше — вносится
   *    в мастер руками, вместе с провенансом. */
  const editableDays = computed(() => {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    return [today.value, isoDate(y)]
  })

  /** Дни, у которых события уже лежат в мастере (приехали в генерате). */
  const masterDays = computed(
    () => new Set((masterEvents.value || []).map((e) => e.date)),
  )

  /** Отметки, сделанные в телефоне и ещё не перенесённые в мастер. */
  const pendingExport = computed(() =>
    Object.entries(local.value)
      .filter(([day, entry]) => !isEmpty(entry) && !masterDays.value.has(day))
      .map(([day, entry]) => ({ day, entry }))
      .sort((a, b) => (a.day < b.day ? 1 : -1)),
  )

  function get(day) {
    return local.value[day] || { carriers: [], skips: [], extra: '', note: '' }
  }

  function save(day, entry) {
    const next = { ...local.value }
    if (isEmpty(entry)) delete next[day]
    else next[day] = entry
    local.value = next
    persist()
  }

  function drop(day) {
    const next = { ...local.value }
    delete next[day]
    local.value = next
    persist()
  }

  return { today, editableDays, pendingExport, entries: local, get, save, drop }
}

/* ── ЭКСПОРТ ────────────────────────────────────────────────────────────
   Блок ровно того вида, что лежит в meds/intake_2026.md §4: заголовок с
   датой и строки с одним из четырёх префиксов. Вставляется в мастер без
   правки — иначе перенос превращается в переписывание, а переписывание
   рано или поздно становится пересказом. */
export function exportDay(day, entry, plan = []) {
  const lines = []
  const nameOf = (key) => plan.find((p) => p.key === key)?.name || key

  for (const s of entry.skips || []) {
    lines.push(`- пропуск: ${nameOf(s.key)}${s.slot ? ` — ${s.slot}` : ''}${s.why ? ` — ${s.why}` : ''}`)
  }
  for (const line of (entry.extra || '').split('\n')) {
    if (line.trim()) lines.push(`- внеплановое: ${line.trim()}`)
  }
  for (const c of entry.carriers || []) {
    const detail = (entry.carrierNotes?.[c] || '').trim()
    lines.push(`- носитель: ${c}${detail ? ` (${detail})` : ''}`)
  }
  if ((entry.note || '').trim()) lines.push(`- заметка: ${entry.note.trim()}`)

  const stamp = isoDate()
  return [
    `# Отметка дня из приложения «Контур», выгружена ${stamp}`,
    `## ${day}`,
    ...lines,
    '',
    '# ⛔ Вставить в meds/intake_2026.md, раздел «§4. События», СНИЗУ.',
    '# После внесения: python3 tools/run_all.py --несмотря-на-красное',
  ].join('\n')
}
