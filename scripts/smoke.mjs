#!/usr/bin/env node
/**
 * Дымовая проверка собранного приложения.
 *
 *     npx vite build --outDir /tmp/kdist --emptyOutDir
 *     node scripts/build-preview.mjs --dist /tmp/kdist --out /tmp/preview.html
 *     node scripts/smoke.mjs /tmp/preview.html
 *
 * Что проверяется:
 *   1. приложение поднимается без единой ошибки в консоли;
 *   2. экран входа рисуется и не пускает с неверным паролем;
 *   3. верный пароль пускает внутрь;
 *   4. все четыре раздела рисуются и содержат ожидаемые опорные строки;
 *   5. ⛔ ни на одном экране нет формулировок, запрещённых границами контура
 *      (docs/STANDARD-safety.md): «начни принимать», «отмени», «снизь дозу».
 *
 * ⚠ Пятая проверка — не украшение теста. Правило «контур не назначает и не
 *   отменяет» проверяемо только автоматически: человек, вычитывающий экраны
 *   глазами на десятый раз, перестаёт замечать сползание формулировок. Тест
 *   не замечает усталости.
 */
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import { JSDOM } from 'jsdom'

const file = process.argv[2] || '/tmp/preview.html'
// ⚠ jsdom не исполняет <script type="module"> вовсе — молча пропускает, и
//   тест видит пустую страницу вместо приложения. Бандл после сборки не
//   содержит ни import/export, ни import.meta (проверено grep'ом), поэтому
//   для теста он запускается как обычный скрипт. В браузере он остаётся
//   модулем — здесь меняется только способ запуска, не код.
const html = readFileSync(file, 'utf8').replace('<script type="module">', '<script>')

const errors = []
const dom = new JSDOM(
  `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="theme-color" content="#0A0A0A"></head><body>${html}</body></html>`,
  {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://example.test/app/',
    beforeParse(window) {
      // ⚠⚠ ДВЕ ВЕЩИ, КОТОРЫХ У JSDOM НЕТ, А У ЛЮБОГО БРАУЗЕРА ЕСТЬ.
      //
      //   1. `crypto.subtle` — без него гейт уходит в состояние «браузер не
      //      даёт проверить пароль», и внутрь приложения тест не попадает.
      //   2. `TextEncoder` — jsdom не кладёт его в window (в Node он есть
      //      глобально, но код приложения исполняется в окне jsdom, где его
      //      нет). Приложение падало на `new TextEncoder()` с ReferenceError,
      //      ловило его тем же catch и печатало ту же формулировку — то есть
      //      симптом был неотличим от отсутствия Web Crypto.
      //
      // Оба берутся из Node ОДНИМ комплектом. Это важно: `TextEncoder` и
      // `crypto.subtle` из разных реалмов не работают вместе — Node проверяет
      // аргументы через `instanceof` в своём реалме и отвергает чужой
      // `Uint8Array` как «не BufferSource».
      Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true })
      window.TextEncoder = TextEncoder
      window.TextDecoder = TextDecoder
      window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
      window.console.error = (...a) => errors.push(a.join(' '))
      window.console.warn = (...a) => errors.push(a.join(' '))
    },
  },
)

const { window } = dom
const { document } = window
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
/**
 * Ждать условия, а не «столько-то миллисекунд».
 *
 * ⚠ Фиксированные паузы здесь уже подводили: PBKDF2 на 120 000 итераций в
 *   jsdom занимает от долей секунды до нескольких, в зависимости от машины и
 *   версии движка. Тест с `wait(900)` падал на медленном прогоне и проходил на
 *   быстром — то есть врал в обе стороны. Опрос условия снимает вопрос совсем.
 */
async function until(fn, { timeout = 15000, step = 50 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (fn()) return true
    await wait(step)
  }
  return false
}
// ⚠ Читаем текст ТОЛЬКО из #app, а не из body. В однофайловой сборке внутри
//   body лежат ещё <style> и <script> с бандлом, и их textContent тоже
//   считается: проверка «нет ли на экране такой-то строки» находила бы её в
//   исходниках приложения и всегда срабатывала бы ложно.
const text = () => (document.getElementById('app')?.textContent || '').replace(/\s+/g, ' ')

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
}
function report() {
  let failed = 0
  for (const r of results) {
    if (!r.ok) failed += 1
    console.log(`${r.ok ? '  ok  ' : ' FAIL '} ${r.name}${r.detail ? `  → ${r.detail}` : ''}`)
  }
  console.log(`\n${results.length - failed} из ${results.length} проверок пройдено`)
  return failed
}

/* ── 0. ⛔ ПУБЛИЧНЫЙ СЛОЙ — страница ДО входа (Д-41/Д-43/Д-45) ────────
 *
 * Самая опасная проверка приложения. Приложение одно, файлов данных два, и
 * они лежат в одной папке: перепутать их местами — значит либо выложить
 * медкарту открытой, либо погасить витрину. Глазами это не ловится, потому
 * что оба варианта выглядят как работающая страница.
 */
await until(() => text().includes('Успею'))
const publicText = text()

check('публичная страница открывается без входа', publicText.includes('Успею'))
check('на ней есть Горизонт', publicText.includes('Горизонт'))
check('вилка лет показана', /\d{2}–\d{2}/.test(publicText))
check('объяснение метода рядом с числом', publicText.includes('Как читать'))
check('девиз на месте', publicText.includes('Жить — это команда'))
check('⛔ вопрос «Успею ли я?» на экран не вынесен', !publicText.includes('Успею ли я'))
check('вилка подписана как среднее, а не срок', publicText.includes('не срок человека'))

// ⛔ Закрытый список — docs/PUBLIC-WHITELIST.md §2. Держать синхронно
//    с tools/dashboard_smoke.mjs.
const CLOSED = [
  'курени', 'куриль', 'сигарет', 'давлени', 'мм рт', 'СКФ', 'ЛПНП', 'Lp(a)',
  'липопротеин', 'ИМТ', 'кг/м²', 'мочевая кислота', 'тревога', 'Т-1', 'Т-3',
  'DOC-', 'LAB-', 'подагра', 'ИПП', 'нексиум', 'аркоксия', 'диагноз', 'препарат',
  'Заряд', 'Креатинин',
]
for (const w of CLOSED) {
  check(`закрытого факта нет до входа: «${w}»`,
    !publicText.toLowerCase().includes(w.toLowerCase()))
}

/* Вход открывается кнопкой, а не стоит первым экраном. */
const enter = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Войти')
check('кнопка «Войти» есть в шапке', !!enter)
if (enter) enter.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
await until(() => text().includes('Доступ в контур'))

/* ── 1. экран входа ─────────────────────────────────────────────────── */
check('экран входа рисуется', text().includes('Доступ в контур'))
check('логин зафиксирован', !!document.querySelector('input[readonly]')?.value)
check(
  'логин — b00mbastic',
  document.querySelector('input[readonly]')?.value === 'b00mbastic',
  document.querySelector('input[readonly]')?.value,
)
// SYS-6 (Д-32): вход перестал быть заслоном — данные шифруются. Проверка
// честности осталась, но проверяет новую правду: экран обязан называть
// реальную границу стойкости, а не обещать «защищено» без оговорок.
check(
  'сказано, где граница стойкости',
  text().includes('Стойкость равна стойкости фразы'),
)

/* ── 2. неверный пароль ─────────────────────────────────────────────── */
const pass = document.querySelector('input[type="password"]')
const form = document.querySelector('form')
function type(el, value) {
  el.value = value
  el.dispatchEvent(new window.Event('input', { bubbles: true }))
}
type(pass, 'заведомо неверный')
form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
await until(() => text().includes('Неверный пароль'))
check('неверный пароль не пускает', text().includes('Неверный пароль'))

/* ── 3. верный пароль ───────────────────────────────────────────────── */
/* ⚠ Д-46: без секрета проверки ЗА ВХОДОМ пропускаются, а не валят прогон.
 *   Публичная граница (раздел 0) уже проверена и от пароля не зависит —
 *   она и есть то, что защищает публикацию. Пропуск объявляется вслух
 *   отдельной строкой: молчаливый пропуск читался бы как пройденная
 *   проверка, а это хуже честного «не проверено».
 *   ⛔ Дефолтную фразу сюда не подставляем: она даёт «неверный пароль» и
 *   прячет настоящую причину за ложной. */
if (!process.env.KONTUR_PASS) {
  check('проверки за входом ПРОПУЩЕНЫ (нет KONTUR_PASS)', true,
    'публичная граница проверена; экраны за входом в этом прогоне не открывались')
  process.exit(report() ? 1 : 0)
}
// Пароль — из окружения: после смены фразы владельцем жёстко вшитый
// 'kontur-2026' валил бы дым «неверным паролем», пряча настоящую причину.
type(document.querySelector('input[type="password"]'), process.env.KONTUR_PASS)
document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
await until(() => !text().includes('Доступ в контур'))
check('верный пароль пускает', !text().includes('Доступ в контур'), text().slice(0, 120))

/* ── 4. разделы ─────────────────────────────────────────────────────── */
// Данные приезжают асинхронно (в однофайловой сборке — из вложенного JSON,
// но всё равно через микротаск), поэтому ждём не вкладки, а содержимое.
// ⚠ Пять, а не четыре: 29.08.2026 добавлен «День» (SYS-10, Д-33). «Задачи»
//   вкладкой не стали — они раздел внутри «Данных» (SYS-15).
/* ⚠ Шесть, а не пять (решение владельца 30.08.2026). Первой стоит
   «Горизонт» — та же публичная страница, что видна до входа: войдя, вернуться
   к ней было нельзя вообще никак, кроме перезагрузки вкладки. */
const TAB_COUNT = 6
await until(() => document.querySelectorAll('[role="tab"]').length === TAB_COUNT)
await until(() => /полнота \d+%/.test(text()))
const screens = {}
const tabs = [...document.querySelectorAll('[role="tab"]')]
check('шесть вкладок', tabs.length === TAB_COUNT, `найдено ${tabs.length} · ${text().slice(0, 200)}`)
/* ⛔ Выход обязателен и стоит на каждом экране: без него человек, вошедший
   на телефоне в полноэкранном режиме, заперт внутри — перезагрузить нечем. */
check('кнопка «Выйти» есть в шапке',
  [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Выйти'))
check('плитки разделов на «Заряде»', text().includes('Разделы'))
check('«Контроль рисков» доступен с первого экрана', text().includes('Контроль рисков'))

/* ⛔ Экран «Риски» обязан нести ВЕСЬ дашборд, а не его часть (Д-48).
 *   Он и apps/risk/health-risk.html рисуют один payload; если экран начнёт
 *   терять секции, заметить это будет некому — рядом их никто не открывает.
 *   Поэтому каждая секция проверяется поимённо. */
{
  const openRisk = [...document.querySelectorAll('button')]
    .find((b) => b.textContent.includes('Контроль рисков'))
  if (openRisk) {
    openRisk.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await wait(400)
    const rt = text()
    for (const [label, needle] of [
      ['свод и полнота картины', 'полнота картины'],
      ['плитки свода', 'Органов в красном'],
      ['светофор органов', 'Светофор органов-мишеней'],
      ['расстояние до целей', 'Расстояние до целей'],
      ['тревоги с адресатами', 'К кому:'],
      ['точность контура', 'Точность контура'],
      ['пробелы Р-6', 'Не измерялось ни разу'],
      ['пробелы на фоне терапии', 'Пробел на фоне терапии'],
      ['горизонт и «не учтено»', 'Не учтено в модели'],
      ['методика', 'что делать'],
    ]) check(`риски: ${label}`, rt.includes(needle))
    check('риски: точность при нуле исходов названа неизвестной',
      !rt.includes('Точность контура неизвестна') || rt.includes('исходов 0 из'))
    // Возвращаемся на «Заряд»: следующие проверки ждут его.
    const back = [...document.querySelectorAll('[role="tab"]')]
      .find((x) => x.textContent.trim() === 'Заряд')
    if (back) back.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await wait(250)
  }
}
// Без вкладок дальше идти некуда: следующая строка обратилась бы к tabs[0] и
// упала бы трейсбеком, спрятав уже собранные результаты. Печатаем их и выходим.
if (tabs.length !== TAB_COUNT) {
  report()
  process.exit(1)
}

screens['Заряд'] = text()
check('заряд: полнота показана', /полнота \d+%/.test(screens['Заряд']))
check('заряд: граница контура на экране', screens['Заряд'].includes('не назначает и не отменяет'))

/* ⚠ Разделы открываются ПО ПОДПИСИ, а не по номеру вкладки. Номера здесь
   уже подводили: 30.08.2026 первой в капсулу встал «Горизонт», нумерация
   сдвинулась на единицу, и девять проверок разом позеленели бы на чужих
   экранах, если бы искали текст не там, где думают. Подпись переживает
   любой порядок. */
const openTab = (label) => {
  const b = [...document.querySelectorAll('[role="tab"]')]
    .find((x) => x.textContent.trim() === label)
  if (!b) return false
  b.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  return true
}
for (const label of ['Заряд', 'День', 'Системы', 'Прогресс', 'Данные']) {
  check(`вкладка «${label}» есть в капсуле`, openTab(label))
  await wait(140)
  screens[label] = text()
}

check('системы: шесть систем', ['Сердце и сосуды', 'Почки', 'Печень', 'ЖКТ и желудок', 'Суставы и обмен', 'Мозг и нервная система']
  .every((n) => screens['Системы'].includes(n)))
check('прогресс: раздел рисуется', screens['Прогресс'].includes('Заряд по неделям'))
check('данные: свежесть картины', screens['Данные'].includes('Свежесть картины'))
check('данные: пробелы на фоне терапии', screens['Данные'].includes('Пробелы на фоне терапии'))

/* ── SYS-10: экран «День» ────────────────────────────────────────────── */
check('день: экран открывается', screens['День'].includes('Обычный день'))
check('день: экспозиция показана', screens['День'].includes('Экспозиция'))
// ⚠ Оговорка про неполное окно — не украшение. Без неё «0 дней из 30» на
//   молодом слое читается как измеренный ноль (канон Р-6).
check('день: сказано, с какой даты ведётся слой', /Слой ведётся с/.test(screens['День']))
check('день: отметка — только отклонения',
  screens['День'].includes('Отметить событие') && screens['День'].includes('отклонения'))

/* ── SYS-15: раздел «Задачи» внутри «Данных» ──────────────────────────
 * Вкладкой он не стал (иначе их было бы шесть), поэтому проверяется не
 * кликом по капсуле, а переходом на под-вкладку внутри «Данных». Текст
 * раздела кладётся в общий свод screens — значит, он попадает в обход
 * запрещённых формулировок ниже автоматически, как и все экраны. */
openTab('Данные')
await wait(120)
const tasksTab = [...document.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === 'Задачи')
check('данные: под-вкладка «Задачи» есть', !!tasksTab)
if (tasksTab) {
  tasksTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await until(() => /Открыто \d+ задач/.test(text()))
  screens['Задачи'] = text()
  check('задачи: экран открывается', /Открыто \d+ задач/.test(screens['Задачи']))
  check('задачи: группы по приоритету', ['Горит', 'Высокий', 'Средний']
    .every((g) => screens['Задачи'].includes(g)))
  check('задачи: фильтр «Визиты» есть', screens['Задачи'].includes('Визиты'))
  // ⛔ Д-12: экран читает, не пишет. Строка про это — часть проверки, а не
  //    оформление: исчезнет она — исчезнет и граница.
  check('задачи: сказано, что приложение их не закрывает',
    screens['Задачи'].includes('не закрывает задачи'))
}

/* ── 5. ⛔ границы контура ──────────────────────────────────────────── */
const FORBIDDEN = [
  /начни(те)? принимать/i,
  /начать приём препарата/i,
  /отмени(те)? (препарат|приём)/i,
  /сниз(ь|ьте|ить) дозу/i,
  /увелич(ь|ьте|ить) дозу/i,
  /вам нужно (пить|принимать)/i,
  /у вас (диагноз|заболевание)/i,
  /рекомендуем препарат/i,
]
const all = Object.values(screens).join(' ')
for (const re of FORBIDDEN) {
  const m = all.match(re)
  check(`запрещённая формулировка отсутствует: ${re.source}`, !m, m ? m[0] : '')
}

/* ── итог ───────────────────────────────────────────────────────────── */
const realErrors = errors.filter((e) => !/Error: Not implemented|jsdom/i.test(e))
check('ни одной ошибки в консоли', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

process.exit(report() ? 1 : 0)
