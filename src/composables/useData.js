import { ref } from 'vue'

/* ═══════════════════════════════════════════════════════════════════════
   ЗАГРУЗКА ГЕНЕРАТА

   Приложение — ПОТРЕБИТЕЛЬ (CLAUDE.md, «Три сущности»). Оно не разбирает
   мастера, не считает СКФ и не переписывает формулировки: всё это делает
   `tools/build_app_data.py`, а сюда приезжает готовый `data/health.json`.
   Направление одностороннее. Если чего-то не хватает на экране — правится
   мастер и генератор, а не этот файл.

   ⚠ Путь относительный (`./data/health.json`) — под base:'./' из vite.config.js.
     Абсолютный `/data/...` сломался бы на GitHub Pages, где приложение живёт
     не в корне домена.
   ═══════════════════════════════════════════════════════════════════════ */

const data = ref(null)
const loading = ref(false)
const error = ref(null)

let started = false

export function useData() {
  async function load() {
    if (started) return
    started = true
    loading.value = true
    try {
      // Однофайловая сборка (scripts/build-preview.mjs) вкладывает данные
      // прямо в страницу: там нечего запрашивать, файл один. Обычная сборка
      // этой ветки не видит — глобали нет.
      if (globalThis.__KONTUR_DATA__) {
        data.value = globalThis.__KONTUR_DATA__
        return
      }
      const base = import.meta.env.BASE_URL || './'
      const res = await fetch(`${base}data/health.json`, { cache: 'no-cache' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      data.value = await res.json()
    } catch (e) {
      // Честная формулировка вместо «что-то пошло не так»: единственная
      // реальная причина здесь — файла нет в сборке, то есть забыли прогнать
      // генератор перед пушем. Так и написано, чтобы чинилось за минуту.
      error.value =
        'Не удалось прочитать данные контура. Проверьте, что перед сборкой был ' +
        'выполнен python3 tools/build_app_data.py и файл data/health.json попал в репозиторий.'
      started = false
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, load }
}

/** Возраст записи в днях. null, если даты нет. */
export function ageDays(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

/** «943 дня», «2 года 7 месяцев» — человеческая длительность без ложной точности. */
export function humanAge(days) {
  if (days === null || days === undefined) return '—'
  if (days < 45) return `${days} ${plural(days, 'день', 'дня', 'дней')}`
  const months = Math.round(days / 30.4)
  if (months < 18) return `${months} ${plural(months, 'месяц', 'месяца', 'месяцев')}`
  const years = Math.floor(months / 12)
  const rest = months % 12
  const y = `${years} ${plural(years, 'год', 'года', 'лет')}`
  return rest ? `${y} ${rest} ${plural(rest, 'месяц', 'месяца', 'месяцев')}` : y
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

/** '2024-01-25' → '25.01.2024' */
export function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}
