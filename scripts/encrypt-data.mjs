#!/usr/bin/env node
/**
 * Шифрование данных приложения. SYS-6 (Д-32, 29.08.2026).
 *
 *     KONTUR_PASS='фраза' node scripts/encrypt-data.mjs
 *     KONTUR_PASS='фраза' node scripts/encrypt-data.mjs --decrypt   # для CI
 *
 * Зачем. Репозиторий приложения публичный, и до этого шага public/data/health.json
 * лежал в нём открытым текстом: пароль на экране входа был заслоном от случайного
 * гостя, но не защитой — диагнозы читались прямо из истории git. Теперь в
 * репозиторий коммитится только health.enc.json (AES-256-GCM), а открытый файл
 * добавлен в .gitignore и живёт лишь на машине владельца.
 *
 * Схема. Ключ = PBKDF2-HMAC-SHA256(пароль, PASSCODE_SALT + ':data', те же
 * итерации, что у гейта). Соль с суффиксом — чтобы ключ шифрования никогда не
 * совпадал с хешем входа: хеш лежит в публичном config.js, и будь они одной
 * производной, публикация хеша была бы публикацией ключа.
 *
 * ⚠ Пароль передаётся ТОЛЬКО через переменную окружения KONTUR_PASS, не
 *   аргументом: аргументы видны в истории шелла и в списке процессов.
 * ⛔ Честная граница: пароль по-прежнему проверяется в браузере, и стойкость
 *   равна стойкости фразы. Короткая фраза перебирается по словарю офлайн —
 *   теперь это единственная атака, но она остаётся. Фраза должна быть длинной.
 */
import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const PLAIN = join(root, 'public', 'data', 'health.json')
const ENC = join(root, 'public', 'data', 'health.enc.json')

const config = readFileSync(join(root, 'src', 'config.js'), 'utf8')
const salt = /PASSCODE_SALT = '([^']+)'/.exec(config)?.[1]
const iterations = Number(/PASSCODE_ITERATIONS = (\d+)/.exec(config)?.[1])
if (!salt || !iterations) {
  console.error('Не нашёл PASSCODE_SALT / PASSCODE_ITERATIONS в src/config.js')
  process.exit(1)
}

const pass = process.env.KONTUR_PASS
if (!pass) {
  console.error("Пароль не задан. Использование: KONTUR_PASS='фраза' node scripts/encrypt-data.mjs [--decrypt]")
  process.exit(1)
}

const key = pbkdf2Sync(pass, salt + ':data', iterations, 32, 'sha256')

if (process.argv.includes('--decrypt')) {
  // Обратный ход — для CI: дымовой проверке нужен открытый файл, в репозитории
  // его нет. Расшифрованное живёт только в раннере и никуда не коммитится.
  const blob = JSON.parse(readFileSync(ENC, 'utf8'))
  const iv = Buffer.from(blob.iv, 'base64')
  const ct = Buffer.from(blob.ct, 'base64')
  const tag = ct.subarray(ct.length - 16)
  const body = ct.subarray(0, ct.length - 16)
  const d = createDecipheriv('aes-256-gcm', key, iv)
  d.setAuthTag(tag)
  let plain
  try {
    plain = Buffer.concat([d.update(body), d.final()])
  } catch {
    console.error('Расшифровка не удалась: пароль не совпадает с тем, которым файл был зашифрован.')
    process.exit(1)
  }
  writeFileSync(PLAIN, plain)
  console.log(`✓ ${PLAIN} восстановлен (${plain.length} байт)`)
  process.exit(0)
}

if (!existsSync(PLAIN)) {
  console.error(`Нет ${PLAIN}. Сначала: python3 tools/build_app_data.py в репозитории контура.`)
  process.exit(1)
}
const plain = readFileSync(PLAIN)
const iv = randomBytes(12)
const c = createCipheriv('aes-256-gcm', key, iv)
const body = Buffer.concat([c.update(plain), c.final()])
const ct = Buffer.concat([body, c.getAuthTag()]) // тег в хвосте, как ждёт WebCrypto
writeFileSync(ENC, JSON.stringify({
  v: 1,
  alg: 'AES-256-GCM',
  kdf: `PBKDF2-SHA256/${iterations}`,
  iv: iv.toString('base64'),
  ct: ct.toString('base64'),
}))
console.log(`✓ ${ENC} (${ct.length} байт шифртекста из ${plain.length} открытых)`)
console.log('  Коммитится ТОЛЬКО .enc — health.json в .gitignore приложения.')
