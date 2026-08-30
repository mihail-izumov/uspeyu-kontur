<script setup>
/*
  «КОНТРОЛЬ РИСКОВ» — экран за входом (решение владельца 30.08.2026).

  ⛔ ПОЧЕМУ ЭКРАН, А НЕ ССЫЛКА НА apps/risk/health-risk.html.
  Тот дашборд — открытый HTML с тревогами, показателями и органами внутри.
  Репозиторий приложения публичный: положить файл в public/ значит выложить
  медкарту в интернет открытым текстом. Ссылка на file:/// при этом не
  работает ни на Pages, ни с телефона — файл живёт на машине владельца.
  Здесь те же сведения, но из health.json, то есть за паролем.

  ⛔ ПРИЛОЖЕНИЕ НИЧЕГО НЕ СЧИТАЕТ ЗАНОВО (Д-29). Светофор органов, статусы
  маркёров и формулировки тревог приезжают из генератора дословно. Не
  хватает чего-то на экране — правится мастер и build_app_data.py.

  ⚠ ЧЕМ ЭТОТ ЭКРАН ОТЛИЧАЕТСЯ ОТ «СИСТЕМ». «Системы» отвечают на вопрос
  «что с органом»: показатели, цели, тренды. Здесь — «за чем следит контур
  и насколько ему можно верить»: открытые тревоги с адресатами и сроками
  проверки исхода, и честная самооценка. Пересечение есть только в
  светофоре, и это намеренно: он тут заголовком, а не содержанием.
*/
import { computed } from 'vue'
import { humanAge } from '../composables/useData.js'

const props = defineProps({ data: { type: Object, required: true } })

const systems = computed(() => props.data.systems || [])
const alerts = computed(() => props.data.alerts || [])

const openAlerts = computed(() => alerts.value.filter((a) => a.open !== false))
const closedAlerts = computed(() => alerts.value.filter((a) => a.open === false))

/* ⚠ ПОЛНОТА КАРТИНЫ, А НЕ ТОЧНОСТЬ. Верхнее число говорит, по какой доле
   ключевых маркёров у контура вообще есть ряд. Точность поставить сюда
   нельзя: проверять её нечем, пока у тревог нет исходов, и число, которого
   не существует, наверху страницы — ровно тот обман, ради запрета которого
   контур и заведён. */
const fullness = computed(() => {
  const all = systems.value.flatMap((s) => s.markers || [])
  const counted = all.filter((m) => ['full', 'stale', 'thin', 'gap'].includes(m.status))
  if (!counted.length) return null
  const good = counted.filter((m) => ['full', 'stale'].includes(m.status))
  return Math.round((100 * good.length) / counted.length)
})

const gaps = computed(() => systems.value
  .flatMap((s) => (s.markers || []).map((m) => ({ ...m, organ: s.short || s.name })))
  .filter((m) => m.status === 'gap'))

const LIGHT = { '🟢': 'ok', '🟡': 'watch', '🔴': 'alarm' }
function tone(light) { return LIGHT[light] || 'unknown' }
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- ═══ СВОД ═══ -->
    <section
      class="rounded-[20px] border px-5 py-5"
      :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', boxShadow: 'var(--card-shadow)' }"
    >
      <div class="flex items-baseline justify-between gap-4">
        <div>
          <p class="text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
            Полнота картины
          </p>
          <p class="mt-1 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-secondary)' }">
            Доля ключевых показателей, по которым у контура есть ряд.
            Растёт только сдачей анализов.
          </p>
        </div>
        <p class="font-mono text-[2.25rem] font-semibold tabular-nums leading-none">
          {{ fullness === null ? '—' : fullness }}
        </p>
      </div>
    </section>

    <!-- ═══ СВЕТОФОР ОРГАНОВ ═══ -->
    <section>
      <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]"
          :style="{ color: 'var(--text-muted)' }">Светофор органов</h2>
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="s in systems"
          :key="s.code"
          class="rounded-[18px] border px-4 py-3"
          :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
        >
          <div class="flex items-center gap-2">
            <span class="block h-2.5 w-2.5 shrink-0 rounded-full"
                  :style="{ background: `var(--sig-${tone(s.light)})` }" aria-hidden="true"></span>
            <p class="truncate text-[0.9375rem] font-semibold">{{ s.short || s.name }}</p>
          </div>
          <p class="mt-1 text-[0.8125rem]" :style="{ color: 'var(--text-muted)' }">
            {{ (s.alerts || []).length }} тревог · {{ (s.markers || []).filter((m) => m.status === 'gap').length }} без данных
          </p>
        </div>
      </div>
      <p class="mt-2 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
        ⛔ Красный не означает болезнь. Он означает, что по органу есть показатель
        вне личной цели, уходящий от цели, или пробел там, где пробела быть не должно.
      </p>
    </section>

    <!-- ═══ ТРЕВОГИ ═══ -->
    <section>
      <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]"
          :style="{ color: 'var(--text-muted)' }">Открытые тревоги</h2>
      <div class="flex flex-col gap-3">
        <article
          v-for="a in openAlerts"
          :key="a.code"
          class="rounded-[18px] border-l-[3px] border px-4 py-3"
          :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', borderLeftColor: 'var(--sig-alarm)' }"
        >
          <div class="flex flex-wrap items-baseline gap-2">
            <span class="font-mono text-[0.75rem] font-semibold">{{ a.code }}</span>
            <span class="text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">{{ a.date }}</span>
          </div>
          <p class="mt-1 text-[0.9375rem] font-medium leading-snug">{{ a.title }}</p>
          <p v-if="a.who" class="mt-2 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-secondary)' }">
            <b>К кому:</b> {{ a.who }}
          </p>
          <p v-if="a.outcome" class="mt-1 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
            <b>Исход:</b> {{ a.outcome }}
          </p>
        </article>
      </div>
      <p v-if="!openAlerts.length" class="text-[0.875rem]" :style="{ color: 'var(--text-muted)' }">
        Открытых тревог нет.
      </p>
    </section>

    <!-- ═══ ТОЧНОСТЬ ═══ -->
    <section
      class="rounded-[20px] border px-5 py-5"
      :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
    >
      <h2 class="font-label text-[0.75rem] uppercase tracking-[0.14em]"
          :style="{ color: 'var(--text-muted)' }">Точность контура</h2>
      <p v-if="!closedAlerts.length" class="mt-2 text-[0.875rem] leading-relaxed">
        ⚠ <b>Точность контура неизвестна: исходов {{ closedAlerts.length }} из {{ alerts.length }}.</b>
        Прибор, который ни разу не проверялся фактом, не имеет права называть свою
        точность — ни хорошей, ни плохой. Число появится здесь, когда у тревог
        начнут появляться исходы.
      </p>
      <p v-else class="mt-2 text-[0.875rem] leading-relaxed">
        Из {{ alerts.length }} тревог исход записан у {{ closedAlerts.length }}.
      </p>
    </section>

    <!-- ═══ ПРОБЕЛЫ ═══ -->
    <section v-if="gaps.length">
      <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]"
          :style="{ color: 'var(--text-muted)' }">Не измерялось ни разу</h2>
      <div class="rounded-[18px] border px-4 py-2"
           :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }">
        <div v-for="m in gaps" :key="m.key + m.organ"
             class="flex items-baseline justify-between gap-3 border-b py-2 last:border-b-0"
             :style="{ borderColor: 'var(--line)' }">
          <span class="text-[0.875rem]">{{ m.name || m.key }}</span>
          <span class="shrink-0 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">{{ m.organ }}</span>
        </div>
      </div>
      <p class="mt-2 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
        Канон Р-6: «не измерялось» ≠ «в норме». Пробел — это риск, а не тишина.
      </p>
    </section>

    <p class="text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
      ⛔ Экран не назначает и не отменяет ничего. Он показывает, что видно в данных,
      и к кому с этим идти. Вероятностей заболеваний контур не выпускает (канон Р-2).
      <template v-if="data.last_draw">
        Данные собраны {{ humanAge(null) === '—' ? '' : '' }}по забору от {{ data.last_draw }}.
      </template>
    </p>
  </div>
</template>
