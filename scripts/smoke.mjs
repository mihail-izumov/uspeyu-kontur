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

await until(() => text().includes('Доступ в контур'))

/* ── 1. экран входа ─────────────────────────────────────────────────── */
check('экран входа рисуется', text().includes('Доступ в контур'))
check('логин зафиксирован', !!document.querySelector('input[readonly]')?.value)
check(
  'логин — b00mbastic',
  document.querySelector('input[readonly]')?.value === 'b00mbastic',
  document.querySelector('input[readonly]')?.value,
)
check(
  'сказано, что это не защита',
  text().includes('заслон от случайного гостя'),
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
type(document.querySelector('input[type="password"]'), 'kontur-2026')
document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
await until(() => !text().includes('Доступ в контур'))
check('верный пароль пускает', !text().includes('Доступ в контур'), text().slice(0, 120))

/* ── 4. разделы ─────────────────────────────────────────────────────── */
// Данные приезжают асинхронно (в однофайловой сборке — из вложенного JSON,
// но всё равно через микротаск), поэтому ждём не вкладки, а содержимое.
await until(() => document.querySelectorAll('[role="tab"]').length === 4)
await until(() => /полнота \d+%/.test(text()))
const screens = {}
const tabs = [...document.querySelectorAll('[role="tab"]')]
check('четыре вкладки', tabs.length === 4, `найдено ${tabs.length} · ${text().slice(0, 200)}`)
// Без вкладок дальше идти некуда: следующая строка обратилась бы к tabs[0] и
// упала бы трейсбеком, спрятав уже собранные результаты. Печатаем их и выходим.
if (tabs.length !== 4) {
  report()
  process.exit(1)
}

screens['Заряд'] = text()
check('заряд: полнота показана', /полнота \d+%/.test(screens['Заряд']))
check('заряд: граница контура на экране', screens['Заряд'].includes('не назначает и не отменяет'))

for (const [i, label] of ['Заряд', 'Системы', 'Прогресс', 'Данные'].entries()) {
  tabs[i].dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await wait(120)
  screens[label] = text()
}

check('системы: шесть систем', ['Сердце и сосуды', 'Почки', 'Печень', 'ЖКТ и желудок', 'Суставы и обмен', 'Мозг и нервная система']
  .every((n) => screens['Системы'].includes(n)))
check('прогресс: раздел рисуется', screens['Прогресс'].includes('Заряд по неделям'))
check('данные: свежесть картины', screens['Данные'].includes('Свежесть картины'))
check('данные: пробелы на фоне терапии', screens['Данные'].includes('Пробелы на фоне терапии'))

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
