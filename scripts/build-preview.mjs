#!/usr/bin/env node
/**
 * Однофайловая сборка для предпросмотра.
 *
 *     npm run build && node scripts/build-preview.mjs
 *
 * Складывает содержимое dist/ в ОДИН html без внешних запросов: скрипт, стили
 * и данные вкладываются внутрь. Нужен для двух вещей:
 *   • посмотреть приложение с телефона, не поднимая сервер и не пушá на Pages;
 *   • приложить к переписке проверяемый артефакт, а не скриншот.
 *
 * ⚠ ЭТО НЕ ПРОДУКТОВАЯ СБОРКА. Здесь нет service worker и нет обновления
 *   данных: файл — снимок на момент сборки. Открывать его как «приложение» и
 *   принимать по нему решения нельзя — он не узнает о новых анализах никогда.
 *   Настоящее приложение живёт на Pages и данные тянет по сети.
 *
 * ⚠ Тег <title> есть, а <html>/<head>/<body> — нет: файл рассчитан на
 *   вставку в готовый каркас страницы.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
// Каталог сборки можно переопределить: `--dist <путь>`. Пригодится, когда
// vite собирает не в ./dist (например, на файловой системе без прав на
// удаление, где приходится складывать сборку во временный каталог).
const distArg = process.argv.indexOf('--dist')
const dist = distArg !== -1 ? process.argv[distArg + 1] : join(root, 'dist')
const assets = join(dist, 'assets')

const files = readdirSync(assets)
const js = files.find((f) => f.endsWith('.js'))
const css = files.find((f) => f.endsWith('.css'))

if (!js || !css) {
  console.error('Не найден бандл в dist/assets. Сначала: npm run build')
  process.exit(1)
}

const data = readFileSync(join(root, 'public', 'data', 'health.json'), 'utf8')
const style = readFileSync(join(assets, css), 'utf8')
const script = readFileSync(join(assets, js), 'utf8')

const out = [
  '<title>Контур здоровья</title>',
  `<style>${style}</style>`,
  '<div id="app"></div>',
  // JSON вкладывается через <script type="application/json">, а не через
  // литерал в коде: так его не надо экранировать, и любые кавычки внутри
  // данных не ломают страницу. Единственное, что нужно закрыть, — </script>.
  `<script type="application/json" id="kontur-data">${data.replace(/<\/script/gi, '<\\/script')}</script>`,
  '<script>window.__KONTUR_DATA__ = JSON.parse(document.getElementById("kontur-data").textContent)</script>',
  `<script type="module">${script}</script>`,
].join('\n')

const outArg = process.argv.indexOf('--out')
const target = outArg !== -1 ? process.argv[outArg + 1] : join(dist, 'preview.html')
writeFileSync(target, out, 'utf8')
console.log(`preview: ${target} (${Math.round(out.length / 1024)} КБ)`)
