#!/usr/bin/env node
/**
 * Считает хеш пароля для src/config.js.
 *
 *     node scripts/passcode.mjs "моя новая фраза"
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

const phrase = process.argv.slice(2).join(' ')
if (!phrase) {
  console.error('Использование: node scripts/passcode.mjs "фраза"')
  process.exit(1)
}

const hash = pbkdf2Sync(phrase, salt, iterations, 32, 'sha256').toString('hex')
console.log('\nсоль:      ', salt)
console.log('итераций:  ', iterations)
console.log('\nВставить в src/config.js:\n')
console.log(`export const PASSCODE_HASH =\n  '${hash}'\n`)
