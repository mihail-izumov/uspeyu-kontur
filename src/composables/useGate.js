import { ref } from 'vue'
import { LOGIN, PASSCODE_HASH, PASSCODE_SALT, PASSCODE_ITERATIONS, SESSION_TTL_MS } from '../config.js'
import { setDataKey } from './useData.js'

/* ═══════════════════════════════════════════════════════════════════════
   ГЕЙТ ВХОДА

   Устройство перенесено из «Бумбастика» (boom-cmd/src/composables/useAccessKey.js),
   но проверка другая: там фраза уходила на бэкенд, здесь бэкенда нет и
   сверка идёт в браузере. Что осталось тем же:

     • фраза НЕ сохраняется на диск — живёт только в памяти вкладки.
       Любое полное открытие страницы требует ввести её заново;
     • абсолютный таймаут сессии (час), даже без перезагрузки;
     • состояние `ready` до первой проверки, чтобы не мигать формой входа.

   ⚠ ПОЧЕМУ ФРАЗА НЕ ЛОЖИТСЯ В localStorage. Соблазн понятен: приложение на
     телефоне открывается по десять раз в день, и вводить пароль каждый раз
     утомительно. Но фраза в localStorage переживает закрытие приложения и
     достаётся любому, кто откроет консоль, — то есть гейт перестаёт делать
     единственное, ради чего заведён. Компромисс здесь один: срок сессии.
     Час — это про «отложил телефон и вернулся», а не про «следующий день».

   ⛔ Ошибка «неверный пароль» НИКОГДА не говорит, каким он должен быть, и не
     показывает подсказок. Экран, который на третьей попытке пишет «первая
     буква К», — это не забота, а дыра.
   ═══════════════════════════════════════════════════════════════════════ */

const authed = ref(false)   // пускать в оболочку
const ready = ref(false)    // стартовая инициализация завершена
const checking = ref(false) // идёт проверка фразы
const error = ref(false)    // неверная фраза при сабмите
const notice = ref(null)    // нейтральное «сессия завершена»
const unsupported = ref(false) // браузер без Web Crypto

let sessionStartedAt = 0
let timer = null

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * PBKDF2-HMAC-SHA256. Обязан совпадать со scripts/passcode.mjs до последнего
 * параметра, иначе верный пароль будет отвергаться, а причина останется
 * невидимой: экран скажет «неверный», хотя неверна настройка.
 */
async function derive(phrase) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(phrase), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(PASSCODE_SALT), iterations: PASSCODE_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return toHex(bits)
}

/**
 * Сравнение за постоянное время.
 *
 * ⚠ Здесь это скорее принцип, чем необходимость: оба значения уже в браузере
 *   пользователя, и мерить время нашего сравнения ему незачем — он может
 *   просто прочитать хеш в исходниках. Но `a === b` на строках в движке
 *   выходит на первом же несовпадающем байте, и писать так в коде проверки
 *   пароля — значит закреплять привычку, которая в следующем проекте, уже с
 *   бэкендом, обойдётся дорого.
 */
function equalConstantTime(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function scheduleExpiry() {
  if (timer) clearTimeout(timer)
  const left = SESSION_TTL_MS - (Date.now() - sessionStartedAt)
  timer = setTimeout(() => {
    authed.value = false
    notice.value = 'Сессия завершена. Введите пароль заново.'
  }, Math.max(0, left))
}

export function useGate() {
  if (!ready.value) {
    // crypto.subtle недоступен на http:// (кроме localhost) — это не наша
    // ошибка, но экран обязан сказать причину, а не «неверный пароль».
    unsupported.value = !(globalThis.crypto && globalThis.crypto.subtle)
    ready.value = true
  }

  async function submit(phrase) {
    error.value = false
    notice.value = null
    if (unsupported.value) return
    const v = String(phrase || '').trim()
    if (!v) return

    checking.value = true
    try {
      const got = await derive(v)
      if (equalConstantTime(got, PASSCODE_HASH)) {
        sessionStartedAt = Date.now()
        authed.value = true
        scheduleExpiry()
        /* SYS-6 (Д-32): из той же фразы выводится ключ данных — соль с
         * суффиксом ':data', чтобы ключ никогда не совпадал с хешем входа,
         * который лежит в публичном config.js. Ключ уходит в useData и
         * нигде не хранится: ни в state, ни в storage. Схема обязана
         * побайтно совпадать со scripts/encrypt-data.mjs. */
        const enc = new TextEncoder()
        const km = await crypto.subtle.importKey('raw', enc.encode(v), 'PBKDF2', false, ['deriveKey'])
        const dataKey = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: enc.encode(PASSCODE_SALT + ':data'), iterations: PASSCODE_ITERATIONS, hash: 'SHA-256' },
          km,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt'],
        )
        await setDataKey(dataKey)
      } else {
        error.value = true
      }
    } catch {
      unsupported.value = true
    } finally {
      checking.value = false
    }
  }

  function logout(reason) {
    authed.value = false
    sessionStartedAt = 0
    if (timer) clearTimeout(timer)
    notice.value = reason || null
  }

  return { login: LOGIN, authed, ready, checking, error, notice, unsupported, submit, logout }
}
