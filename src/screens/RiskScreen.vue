<script setup>
/*
  «КОНТРОЛЬ РИСКОВ» — мобильная страница дашборда (Д-48, владелец 30.08.2026).

  ⛔ ЭТО НЕ ПЕРЕСКАЗ ДАШБОРДА, А ТОТ ЖЕ PAYLOAD. `apps/risk/health-risk.html`
  и этот экран рисуют один и тот же объект `data.risk`, собранный
  `tools/risk_dashboard.py:build_data()`. Отобрать сюда «нужные поля» было бы
  вторым источником правды: две страницы разошлись бы при первой правке
  одной из них, и заметить это некому — рядом их никто не открывает.

  ⛔ ПРИЛОЖЕНИЕ НИЧЕГО НЕ СЧИТАЕТ ЗАНОВО (Д-29). Светофор органов — из
  `risk.organ_model()`, статусы маркёров — из `marker_status()`, вилка лет —
  из `life.build()`. Здесь только вёрстка.

  ⚠ ЧЕМ ЭТОТ ЭКРАН ОТЛИЧАЕТСЯ ОТ «СИСТЕМ». «Системы» отвечают «что с
  органом»: показатели, цели, тренды. Здесь — «за чем следит контур и
  насколько ему можно верить»: свод, тревоги с адресатами, честная
  самооценка точности, методика с оговорками. Светофор пересекается
  намеренно — он тут заголовком, а не содержанием.

  ⚠ ПОРЯДОК СЕКЦИЙ ПОВТОРЯЕТ ДАШБОРД и не переставляется по вкусу:
  свод → плитки → светофор → расстояние до целей → тревоги → точность →
  пробелы → горизонт → методика.
*/
import { computed } from 'vue'

const props = defineProps({ risk: { type: Object, default: () => ({}) } })

const r = computed(() => props.risk || {})
const organs = computed(() => r.value.organs || [])
const alerts = computed(() => r.value.alerts || [])
const life = computed(() => r.value.life || {})
const acc = computed(() => r.value.accuracy || { total: 0, open: 0, closed: 0 })

const LIGHT = { '🟢': 'ok', '🟡': 'watch', '🔴': 'alarm' }
const tone = (light) => LIGHT[light] || 'unknown'

const STATUS = {
  full: ['ok', 'полный'], stale: ['watch', 'устарел'], thin: ['watch', 'тонкий'],
  gap: ['alarm', 'пробел'], blocked: ['blocked', 'нельзя сейчас'], none: ['unknown', 'нет цели'],
}
const statusOf = (m) => STATUS[m.status] || STATUS.none

const redOrgans = computed(() => organs.value.filter((o) => o.light === '🔴').length)
const offCount = computed(() => organs.value.reduce((s, o) => s + (o.off || 0), 0))
const unknownCount = computed(() => organs.value.reduce((s, o) => s + (o.unknown || 0), 0))

/* Плитки свода — те же шесть, что в шапке дашборда. */
const KPI = computed(() => [
  { t: 'Органов в красном', v: `${redOrgans.value} из ${organs.value.length}`,
    c: redOrgans.value ? 'alarm' : 'ok', s: 'красный = вне цели, ухудшается или пробел' },
  { t: 'Показателей вне цели', v: offCount.value,
    c: offCount.value ? 'watch' : 'ok', s: 'цели из targets.md' },
  { t: 'Не измерялось ни разу', v: unknownCount.value,
    c: unknownCount.value ? 'alarm' : 'ok', s: 'канон Р-6: пробел = риск' },
  { t: 'Тревог открыто', v: `${acc.value.open} из ${acc.value.total}`,
    c: acc.value.open ? 'watch' : 'ok', s: 'открыта = исход ещё не записан' },
  { t: 'Самой старой точке', v: r.value.oldest_days == null ? '—' : `${r.value.oldest_days} дн`,
    c: (r.value.oldest_days || 0) > 548 ? 'alarm' : 'ok', s: 'граница доверия — 18 месяцев' },
  { t: 'Годы на столе', v: `+${life.value.on_table ?? '—'}`,
    c: 'unknown', s: `горизонт ${life.value.current || '—'} → ${life.value.target || '—'}` },
])

/* Расстояние до целей: длина полосы — во сколько раз дальше цели. */
const far = computed(() => {
  const out = []
  organs.value.forEach((o) => (o.markers || []).forEach((m) => {
    if (m.distance != null && m.distance > 1.001 && m.last_value != null) {
      out.push({ ...m, organ: o.name })
    }
  }))
  return out.sort((a, b) => b.distance - a.distance)
})
const barWidth = (d) => Math.max(4, Math.min(100, Math.round(((d - 1) / 2) * 100)))

const gaps = computed(() => {
  const out = []
  organs.value.forEach((o) => (o.markers || []).forEach((m) => {
    if (m.status === 'gap') out.push({ ...m, organ: o.name })
  }))
  return out
})

const openAlerts = computed(() => alerts.value.filter((a) => a.open))
const closedAlerts = computed(() => alerts.value.filter((a) => !a.open))

/* Разметка журнала снимается: markdown из мастера в вёрстку не уезжает. */
const md = (s) => String(s || '').replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]*)\*\*/g, '$1')

/* Методика — те же шесть карточек «что это значит / что делать», что внизу
   дашборда. Текст живёт в обоих местах: он не данные, а объяснение вёрстки. */
const METH = [
  ['Светофор — про наблюдение, не про диагноз',
   'Красный орган означает: есть показатель вне личной цели, или он уходит от цели, или по нему нет ни одной точки.',
   'Смотреть на тревоги этого органа и на их адресатов. Диагноз ставит врач по документу, а не этот экран.'],
  ['Полнота картины — метрика прибора, а не тела',
   'Верхнее число говорит, по какой доле ключевых показателей у контура вообще есть ряд.',
   'Растёт только сдачей анализов. Низкое число не означает, что со здоровьем плохо, — оно означает, что смотреть не на что.'],
  ['Точность контура пока не существует',
   'Пока у тревог нет исходов, проверить прогнозы нечем.',
   'Закрывать тревоги исходами по мере появления фактов. До тех пор доверять экрану как описанию, а не как замеру.'],
  ['Данные старше 18 месяцев',
   'Показатели с возрастом точки больше 548 дней помечены «устарел». Формально они описывают прошлое.',
   'Свежий забор возвращает экрану смысл. Пока его нет, сравнение с целью — сравнение с позапрошлым годом.'],
  ['Вероятностей заболеваний здесь нет',
   'Канон Р-2: контур считает правилами, а не моделями. На данных одного человека вероятность заболевания — выдумка с видом науки.',
   'Читать пороги и расстояние до целей, а не искать процент риска.'],
  ['Горизонт — среднее, а не срок',
   'Вилка лет описывает профиль с такими факторами. Половина людей такого профиля живёт дольше верхней границы.',
   'Смотреть на разность вилок («годы на столе»): в ней сокращаются систематические ошибки модели.'],
]
</script>

<template>
  <div v-if="!organs.length" class="rounded-[20px] border px-5 py-5"
       :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }">
    <p class="text-[0.875rem]" :style="{ color: 'var(--text-muted)' }">
      Прогон рисков ещё не собран. Данные готовит <code>python3 tools/run_all.py</code>.
    </p>
  </div>

  <div v-else class="flex flex-col gap-5">
    <!-- ═══ СВОД ═══ -->
    <section
      class="rounded-[20px] border border-l-[4px] px-5 py-5"
      :style="{ background: 'var(--surface)', borderColor: 'var(--rim)',
                borderLeftColor: `var(--sig-${r.band === 'ok' ? 'ok' : r.band === 'warn' ? 'watch' : 'alarm'})`,
                boxShadow: 'var(--card-shadow)' }"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-[1.0625rem] font-semibold leading-snug">{{ r.headline }}</p>
          <p class="mt-1 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-muted)' }">{{ r.sub }}</p>
        </div>
        <div class="shrink-0 text-right">
          <p class="font-mono text-[2.25rem] font-semibold leading-none tabular-nums"
             :style="{ color: `var(--sig-${r.band === 'ok' ? 'ok' : r.band === 'warn' ? 'watch' : 'alarm'})` }">
            {{ r.fullness }}
          </p>
          <p class="mt-1 text-[0.6875rem]" :style="{ color: 'var(--text-muted)' }">полнота картины</p>
        </div>
      </div>
      <p class="mt-3 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
        собрано {{ r.built_h }} · {{ r.version }} · возраст {{ r.age }} · заборов {{ r.draws }}
      </p>
    </section>

    <!-- ═══ ПЛИТКИ ═══ -->
    <section class="grid grid-cols-2 gap-3">
      <div v-for="k in KPI" :key="k.t"
           class="relative overflow-hidden rounded-[18px] border py-3 pl-4 pr-3"
           :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }">
        <span class="absolute inset-y-0 left-0 w-[3px]" :style="{ background: `var(--sig-${k.c})` }"></span>
        <p class="text-[0.6875rem]" :style="{ color: 'var(--text-muted)' }">{{ k.t }}</p>
        <p class="mt-1 font-mono text-[1.25rem] font-semibold tabular-nums">{{ k.v }}</p>
        <p class="mt-1 text-[0.6875rem] leading-snug" :style="{ color: 'var(--text-muted)' }">{{ k.s }}</p>
      </div>
    </section>

    <!-- ═══ СВЕТОФОР ОРГАНОВ ═══ -->
    <section>
      <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]"
          :style="{ color: 'var(--text-muted)' }">Светофор органов-мишеней</h2>
      <div class="flex flex-col gap-3">
        <details v-for="o in organs" :key="o.code"
                 class="rounded-[18px] border px-4 py-3"
                 :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }">
          <summary class="flex cursor-pointer items-center gap-2 list-none">
            <span class="block h-2.5 w-2.5 shrink-0 rounded-full"
                  :style="{ background: `var(--sig-${tone(o.light)})` }" aria-hidden="true"></span>
            <span class="text-[0.9375rem] font-semibold">{{ o.name }}</span>
            <span class="ml-auto shrink-0 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
              {{ o.off }} вне цели · {{ o.unknown }} без данных
            </span>
          </summary>
          <div class="mt-2">
            <div v-for="m in o.markers" :key="m.key"
                 class="flex items-baseline justify-between gap-3 border-b py-1.5 last:border-b-0"
                 :style="{ borderColor: 'var(--line)' }">
              <span class="flex min-w-0 items-baseline gap-2">
                <span class="block h-1.5 w-1.5 shrink-0 rounded-full"
                      :style="{ background: `var(--sig-${statusOf(m)[0]})` }"></span>
                <span class="truncate text-[0.8125rem]">{{ m.name }}</span>
              </span>
              <span class="shrink-0 text-right text-[0.8125rem] tabular-nums">
                {{ m.last_value == null ? 'не измерялось' : `${m.last_value} ${m.unit || ''}` }}
                <span class="block text-[0.6875rem]" :style="{ color: 'var(--text-muted)' }">
                  {{ statusOf(m)[1] }}<template v-if="m.target"> · цель {{ m.target }}</template>
                </span>
              </span>
            </div>
          </div>
        </details>
      </div>
      <p class="mt-2 text-[0.75rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
        ⛔ Красный не означает болезнь: он означает показатель вне личной цели,
        уход от цели или пробел там, где пробела быть не должно.
      </p>
    </section>

    <!-- ═══ РАССТОЯНИЕ ДО ЦЕЛЕЙ ═══ -->
    <section v-if="far.length">
      <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]"
          :style="{ color: 'var(--text-muted)' }">Расстояние до целей</h2>
      <div class="rounded-[18px] border px-4 py-2"
           :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }">
        <div v-for="m in far" :key="m.key + m.organ" class="border-b py-2.5 last:border-b-0"
             :style="{ borderColor: 'var(--line)' }">
          <div class="flex items-baseline justify-between gap-3">
            <span class="min-w-0 truncate text-[0.875rem]">{{ m.name }}</span>
            <span class="shrink-0 text-[0.8125rem] tabular-nums">
              {{ m.last_value }} {{ m.unit }} <span :style="{ color: 'var(--text-muted)' }">при цели {{ m.target }}</span>
            </span>
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full" :style="{ background: 'var(--surface-2)' }">
            <span class="block h-full rounded-full"
                  :style="{ width: `${barWidth(m.distance)}%`, background: `var(--sig-${statusOf(m)[0]})` }"></span>
          </div>
          <p class="mt-1 text-[0.6875rem]" :style="{ color: 'var(--text-muted)' }">
            ×{{ m.distance.toFixed(2) }} от цели · {{ m.organ }}<template v-if="m.age_days != null"> · {{ m.age_days }} дн</template>
          </p>
        </div>
      </div>
      <p class="mt-2 text-[0.75rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
        ⚠ Цель ≠ референс лаборатории: референс — «как у 95% населения», цель —
        «куда надо мне при моих диагнозах».
      </p>
    </section>

    <!-- ═══ ТРЕВОГИ ═══ -->
    <section>
      <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]"
          :style="{ color: 'var(--text-muted)' }">Тревоги · Т-NN</h2>
      <div class="flex flex-col gap-3">
        <article v-for="a in [...openAlerts, ...closedAlerts]" :key="a.code"
                 class="rounded-[18px] border border-l-[3px] px-4 py-3"
                 :style="{ background: 'var(--surface)', borderColor: 'var(--rim)',
                           borderLeftColor: a.open ? 'var(--sig-alarm)' : 'var(--line)',
                           opacity: a.open ? 1 : 0.75 }">
          <div class="flex flex-wrap items-baseline gap-2">
            <span class="font-mono text-[0.6875rem] font-bold uppercase tracking-wide"
                  :style="{ color: a.open ? 'var(--sig-alarm)' : 'var(--text-muted)' }">
              {{ a.open ? 'открыта' : 'закрыта' }}
            </span>
            <span class="font-mono text-[0.75rem] font-semibold">{{ a.code }}</span>
            <span class="text-[0.6875rem]" :style="{ color: 'var(--text-muted)' }">{{ a.date }} · {{ a.organ }}</span>
          </div>
          <p class="mt-1 text-[0.9375rem] font-medium leading-snug">{{ md(a.title) }}</p>
          <p v-if="a.who" class="mt-2 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-secondary)' }">
            <b>К кому:</b> {{ md(a.who) }}
          </p>
          <p v-if="a.threshold" class="mt-1 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-secondary)' }">
            <b>Порог:</b> {{ md(a.threshold) }}
          </p>
          <p v-if="a.outcome" class="mt-1 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
            <b>Исход:</b> {{ md(a.outcome) }}
          </p>
          <p v-if="a.codes && a.codes.length" class="mt-1 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
            <b>Связано:</b> {{ a.codes.join(' · ') }}
          </p>
        </article>
      </div>
      <p class="mt-2 text-[0.75rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
        Каждая тревога обязана кончаться исходом и адресатом в халате (Р-1, Р-4).
        Тревога без записанного исхода — контур, который не учится.
      </p>
    </section>

    <!-- ═══ ТОЧНОСТЬ ═══ -->
    <section class="rounded-[20px] border px-5 py-5"
             :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }">
      <h2 class="font-label text-[0.75rem] uppercase tracking-[0.14em]"
          :style="{ color: 'var(--text-muted)' }">Точность контура · Р-4</h2>
      <p v-if="!acc.closed" class="mt-2 text-[0.875rem] leading-relaxed">
        ⚠ <b>Точность контура неизвестна: исходов {{ acc.closed }} из {{ acc.total }}.</b>
        Прибор, который ни разу не проверялся фактом, не имеет права называть свою
        точность — ни хорошей, ни плохой. Число появится, когда у тревог начнут
        появляться исходы.
      </p>
      <p v-else class="mt-2 text-[0.875rem] leading-relaxed">
        Из {{ acc.total }} тревог исход записан у {{ acc.closed }}, ждут исхода {{ acc.open }}.
      </p>
    </section>

    <!-- ═══ ПРОБЕЛЫ ═══ -->
    <section>
      <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]"
          :style="{ color: 'var(--text-muted)' }">Пробелы · Р-6</h2>
      <div class="rounded-[18px] border px-4 py-3"
           :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }">
        <p class="text-[0.8125rem] font-semibold">Не измерялось ни разу — {{ gaps.length }}</p>
        <div v-for="m in gaps" :key="m.key + m.organ" class="border-b py-2 last:border-b-0"
             :style="{ borderColor: 'var(--line)' }">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-[0.875rem]">{{ m.name }}</span>
            <span class="shrink-0 text-[0.6875rem]" :style="{ color: 'var(--text-muted)' }">{{ m.organ }}</span>
          </div>
          <p v-if="m.why_gap || m.why_interval" class="mt-0.5 text-[0.75rem] leading-snug"
             :style="{ color: 'var(--text-muted)' }">{{ m.why_gap || m.why_interval }}</p>
        </div>
      </div>

      <div v-if="(r.therapy_gaps || []).length" class="mt-3 rounded-[18px] border px-4 py-3"
           :style="{ background: 'var(--surface)', borderColor: 'var(--sig-alarm)' }">
        <p class="text-[0.8125rem] font-semibold" :style="{ color: 'var(--sig-alarm-ink)' }">
          Пробел на фоне терапии — {{ r.therapy_gaps.length }}
        </p>
        <div v-for="g in r.therapy_gaps" :key="g.med" class="border-b py-2 last:border-b-0"
             :style="{ borderColor: 'var(--line)' }">
          <p class="text-[0.875rem]">{{ g.med }}</p>
          <p class="mt-0.5 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">{{ (g.watch || []).join(', ') }}</p>
        </div>
        <p class="mt-2 text-[0.75rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
          ⚠ Терапия идёт, контроля нет — это не «ещё не сдал», это слепая зона.
        </p>
      </div>
    </section>

    <!-- ═══ ГОРИЗОНТ ═══ -->
    <section v-if="life.current">
      <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]"
          :style="{ color: 'var(--text-muted)' }">Горизонт · SYS-17</h2>
      <div class="rounded-[18px] border px-4 py-3"
           :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }">
        <div class="flex items-baseline justify-between gap-3 py-1">
          <span class="text-[0.875rem]" :style="{ color: 'var(--text-muted)' }">Текущий круг</span>
          <span class="text-[0.9375rem] font-semibold tabular-nums">{{ life.current }}</span>
        </div>
        <div class="flex items-baseline justify-between gap-3 py-1">
          <span class="text-[0.875rem]" :style="{ color: 'var(--text-muted)' }">Целевой сценарий</span>
          <span class="text-[0.9375rem] font-semibold tabular-nums">{{ life.target }}</span>
        </div>
        <div class="flex items-baseline justify-between gap-3 py-1">
          <span class="text-[0.875rem]" :style="{ color: 'var(--text-muted)' }">Годы на столе</span>
          <span class="text-[0.9375rem] font-semibold tabular-nums">
            +{{ life.on_table }}
            <span class="text-[0.6875rem] font-normal" :style="{ color: 'var(--text-muted)' }">
              [{{ life.on_table_lo }}–{{ life.on_table_hi }}]
            </span>
          </span>
        </div>
        <p v-if="life.old_picture" class="mt-2 text-[0.75rem]" :style="{ color: 'var(--sig-watch-ink)' }">
          ⚠ {{ life.old_picture }}
        </p>

        <div v-for="l in (life.levers || [])" :key="l.key" class="border-t py-2"
             :style="{ borderColor: 'var(--line)' }">
          <div class="flex items-baseline justify-between gap-3">
            <span class="min-w-0 text-[0.8125rem]">{{ l.text }}</span>
            <span class="shrink-0 text-[0.875rem] font-semibold tabular-nums">+{{ l.years }}</span>
          </div>
          <p class="mt-0.5 text-[0.6875rem]" :style="{ color: 'var(--text-muted)' }">
            {{ l.from }} → {{ l.to }} {{ l.unit }}<template v-if="l.stale"> · ⚠ факт устарел</template>
          </p>
        </div>
        <p class="mt-2 text-[0.75rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
          ⛔ Рычаг назван показателем, а не действием: путь к цели — врач.
          Вилка — среднее ожидание для профиля, а не срок человека.
        </p>
      </div>

      <div v-if="(life.not_included || []).length" class="mt-3 rounded-[18px] border px-4 py-3"
           :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }">
        <p class="text-[0.8125rem] font-semibold">Не учтено в модели</p>
        <div v-for="n in life.not_included" :key="n.key" class="border-b py-2 last:border-b-0"
             :style="{ borderColor: 'var(--line)' }">
          <p class="text-[0.875rem] font-medium">{{ n.name }}</p>
          <p class="mt-0.5 text-[0.75rem] leading-snug">{{ n.fact }}</p>
          <p class="mt-0.5 text-[0.75rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
            почему: {{ n.why }}
          </p>
          <p class="mt-0.5 text-[0.75rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
            вес: {{ n.weight }}
          </p>
        </div>
      </div>
    </section>

    <!-- ═══ МЕТОДИКА ═══ -->
    <section>
      <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]"
          :style="{ color: 'var(--text-muted)' }">Методика — что это значит и чего здесь нет</h2>
      <div class="flex flex-col gap-3">
        <div v-for="[t, a, b] in METH" :key="t" class="rounded-[18px] border px-4 py-3"
             :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }">
          <p class="text-[0.875rem] font-semibold leading-snug">{{ t }}</p>
          <p class="mt-2 text-[0.625rem] uppercase tracking-[0.08em]" :style="{ color: 'var(--text-muted)' }">
            что это значит
          </p>
          <p class="text-[0.8125rem] leading-snug">{{ a }}</p>
          <p class="mt-2 text-[0.625rem] uppercase tracking-[0.08em]" :style="{ color: 'var(--text-muted)' }">
            что делать
          </p>
          <p class="text-[0.8125rem] leading-snug">{{ b }}</p>
        </div>
      </div>
    </section>

    <p class="text-[0.75rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
      ⛔ Экран не назначает и не отменяет ничего — он показывает, что видно в данных,
      и к кому с этим идти. Вероятностей заболеваний контур не выпускает (канон Р-2).
      Тот же прогон одной страницей на компьютере — <code>apps/risk/health-risk.html</code>.
    </p>
  </div>
</template>

<style scoped>
/* Стрелка у <details> убрана: свой знак не нужен, роль раскрытия несёт
   вся строка, а системный треугольник в iOS и в Chrome выглядит по-разному. */
summary::-webkit-details-marker { display: none; }
summary::marker { content: ''; }
</style>
