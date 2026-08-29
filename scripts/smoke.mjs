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
      // jsdom не даёт Web Crypto — подкладываем настоящий из Node, иначе гейт
      // ушёл бы в состояние `unsupported` и внутрь мы бы не попали.
      Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true })
      window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
      window.console.error = (...a) => errors.push(a.join(' '))
      window.console.warn = (...a) => errors.push(a.join(' '))
    },
  },
)

const { window } = dom
const { document } = window
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
// ⚠ Читаем текст ТОЛЬКО из #app, а не из body. В однофайловой сборке внутри
//   body лежат ещё <style> и <script> с бандлом, и их textContent тоже
//   считается: проверка «нет ли на экране такой-то строки» находила бы её в
//   исходниках приложения и всегда срабатывала бы ложно.
const text = () => (document.getElementById('app')?.textContent || '').replace(/\s+/g, ' ')

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
}

await wait(400)

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
await wait(700)
check('неверный пароль не пускает', text().includes('Неверный пароль'))

/* ── 3. верный пароль ───────────────────────────────────────────────── */
type(document.querySelector('input[type="password"]'), 'kontur-2026')
document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
await wait(1200)
check('верный пароль пускает', !text().includes('Доступ в контур'), text().slice(0, 120))

/* ── 4. разделы ─────────────────────────────────────────────────────── */
const screens = {}
const tabs = [...document.querySelectorAll('[role="tab"]')]
check('четыре вкладки', tabs.length === 4, `найдено ${tabs.length}`)

screens['Заряд'] = text()
check('заряд: полнота показана', /полнота \d+%/.test(screens['Заряд']))
check('заряд: граница контура на экране', screens['Заряд'].includes('не назначает и не отменяет'))

for (const [i, label] of ['Заряд', 'Системы', 'Прогресс', 'Данные'].entries()) {
  tabs[i].dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await wait(250)
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

let failed = 0
for (const r of results) {
  if (!r.ok) failed += 1
  console.log(`${r.ok ? '  ok  ' : ' FAIL '} ${r.name}${r.detail ? `  → ${r.detail}` : ''}`)
}
console.log(`\n${results.length - failed} из ${results.length} проверок пройдено`)
process.exit(failed ? 1 : 0)
