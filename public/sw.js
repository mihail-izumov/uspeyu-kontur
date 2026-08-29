/* Service worker. Ровно столько, сколько нужно, чтобы приложение открывалось
 * без сети, — и ни строкой больше.
 *
 * ── СТРАТЕГИЯ ───────────────────────────────────────────────────────────
 * Оболочка (html, js, css, иконки) — cache-first: она меняется только при
 * сборке, и ходить за ней в сеть на каждом запуске незачем.
 * ДАННЫЕ (data/health.json) — network-first с откатом в кэш.
 *
 * ⚠⚠ ЭТО ГЛАВНОЕ РЕШЕНИЕ ФАЙЛА, И ОНО НЕ ПРО СКОРОСТЬ. Если данные отдавать
 * из кэша, приложение после внесения новых анализов покажет старую картину и
 * ничем не даст этого понять: те же цифры, тот же светофор, та же дата
 * сборки. Человек сделает вывод по данным двухлетней давности, считая их
 * свежими. В приложении о здоровье это худший из возможных отказов —
 * молчаливый и правдоподобный. Поэтому за данными идём в сеть всегда, а кэш
 * — только запасной выход, когда сети нет.
 *
 * ⚠ Версия кэша поднимается при каждой сборке через плейсхолдер? Нет: он
 *   тут статический и меняется руками. Ошибиться нестрашно — файлы бандла
 *   имеют хеш в имени, и старые записи кэша просто перестают запрашиваться.
 *   Правило одно: при изменении структуры кэша поднять CACHE.
 */
const CACHE = 'kontur-v1'

const SHELL = ['./', './index.html', './manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Данные контура — только через сеть, кэш как запасной выход.
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
          return res
        })
        .catch(() => caches.match(request)),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit
      return fetch(request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
        }
        return res
      })
    }),
  )
})
