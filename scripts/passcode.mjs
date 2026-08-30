#!/usr/bin/env node
/**
 * Считает хеш пароля для src/config.js.
 *
 *     echo -n "моя новая фраза" | node scripts/passcode.mjs   ← так правильно
 *     node scripts/passcode.mjs "моя новая фраза"             ← работает, но хуже
 *
 * ⚠ ФРАЗУ ЛУЧШЕ ПОДАВАТЬ НА ВХОД, А НЕ АРГУМЕНТОМ: аргументы видны в `ps` и
 *   оседают в истории шелла. Это правило записано в scripts/encrypt-data.mjs,
 *   но сам этот скрипт его не соблюдал, и rotate-pass.sh честно передавал
 *   фразу аргументом. Поправлено 29.08.2026 в обоих приложениях сразу.
 *   Обычный путь — `./scripts/rotate-pass.sh`, он спрашивает вслепую.
 *
 * Алгоритм обязан совпадать с тем, что делает браузер в
 * src/composables/useGate.js: PBKDF2-HMAC-SHA256, та же соль, то же число
 * итераций, 32 байта на выходе. Разойдутся — вход перестанет пускать, и
 * причину будет не видно: экран скажет «неверный пароль», хотя пароль верный.
 */
import { pbkdf2Sync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const config = readFileSync(join(here, '..', 'src', 'config.js'), 'utf8')

const salt = /PASSCODE_SALT = '([^']+)'/.exec(config)?.[1]
const iterations = Number(/PASSCODE_ITERATIONS = (\d+)/.exec(config)?.[1])

if (!salt || !iterations) {
  console.error('Не нашёл PASSCODE_SALT / PASSCODE_ITERATIONS в src/config.js')
  process.exit(1)
}

/** Фраза: со стандартного входа (правильно) или аргументом (устаревший путь). */
const phrase = process.argv.length > 2
  ? process.argv.slice(2).join(' ')
  : (process.stdin.isTTY ? '' : readFileSync(0, 'utf8').replace(/\r?\n$/, ''))
if (!phrase) {
  console.error('Использование: echo -n "фраза" | node scripts/passcode.mjs')
  console.error('Обычный путь: ./scripts/rotate-pass.sh — спросит вслепую.')
  process.exit(1)
}

const hash = pbkdf2Sync(phrase, salt, iterations, 32, 'sha256').toString('hex')
console.log('\nсоль:      ', salt)
console.log('итераций:  ', iterations)
console.log('\nВставить в src/config.js:\n')
console.log(`export const PASSCODE_HASH =\n  '${hash}'\n`)
