<script setup>
import { computed, ref } from 'vue'
import ChargeDial from '../components/ChargeDial.vue'
import StatusChip from '../components/StatusChip.vue'
import BottomSheet from '../components/BottomSheet.vue'
import { WEIGHTS, deltaLabel } from '../composables/chargeModel.js'
import { humanAge, ageDays, fmtDate } from '../composables/useData.js'

const props = defineProps({
  data: { type: Object, required: true },
  charge: { type: Object, required: true },
  series: { type: Array, default: () => [] },
  weekFilled: { type: Boolean, default: false },
  isSurveyDue: { type: Boolean, default: false },
})
const emit = defineEmits(['open-survey', 'open-system', 'go'])

const breakdownOpen = ref(false)

/* Плитки разделов. Подпись — не пересказ названия, а то, зачем туда идти:
   иначе плитка повторяет иконку в капсуле и не добавляет ничего. */
const SECTIONS = [
  { id: 'horizon', label: 'Горизонт', hint: 'вилка лет, рычаги, календарь недель' },
  { id: 'day', label: 'День', hint: 'плановый приём и отметка события' },
  { id: 'systems', label: 'Системы', hint: 'шесть органов-мишеней и их показатели' },
  { id: 'progress', label: 'Прогресс', hint: 'недели, ряд «Заряда», разборы' },
  { id: 'data', label: 'Данные', hint: 'пробелы, просрочки, препараты, задачи' },
]

/* Дельта берётся против ПРЕДЫДУЩЕЙ недели ряда, а не против «прошлого
 * запуска приложения». Иначе балл менялся бы от того, что человек открыл
 * экран, а не от того, что изменилось в теле. */
const delta = computed(() => {
  if (props.series.length < 2) return null
  const [prev, last] = props.series.slice(-2)
  return deltaLabel(last.value, prev.value)
})

/* Слагаемые, отсортированные по тому, сколько пунктов они съели. Компоненты
 * без данных идут в конец отдельной группой: «не участвует» — не то же
 * самое, что «ноль штрафа», и мешать их в один список нельзя. */
const counted = computed(() =>
  props.charge.parts.filter((p) => p.points !== null).sort((a, b) => b.points - a.points),
)
const skipped = computed(() => props.charge.parts.filter((p) => p.points === null))

const openAlerts = computed(() => (props.data.alerts || []).slice(0, 3))

const lastDrawAge = computed(() => ageDays(props.data.last_draw))
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- ═══ КОЛЬЦО ═══ -->
    <section
      class="kh-fade-in rounded-[20px] border px-5 pb-6 pt-7"
      :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', boxShadow: 'var(--card-shadow)' }"
    >
      <ChargeDial
        :value="charge.value"
        :low="charge.low"
        :high="charge.high"
        :mode="charge.mode"
        :confidence="charge.confidence"
        :delta="delta"
      />

      <!-- Полнота входных данных — всегда рядом с баллом, а не в настройках.
           Балл без неё обещает точность, которой может не быть. -->
      <div class="mt-5 flex items-center justify-center gap-2">
        <div class="flex gap-[3px]" aria-hidden="true">
          <span
            v-for="i in 10"
            :key="i"
            class="block h-1.5 w-3 rounded-full"
            :style="{ background: i <= Math.round(charge.confidence * 10) ? 'var(--action)' : 'var(--line)' }"
          ></span>
        </div>
        <span class="text-[0.75rem] tabular-nums" :style="{ color: 'var(--text-muted)' }">
          полнота {{ Math.round(charge.confidence * 100) }}%
        </span>
      </div>

      <button
        v-if="charge.mode !== 'blind'"
        type="button"
        class="mx-auto mt-4 flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[0.875rem] active:opacity-60"
        :style="{ color: 'var(--action-text)' }"
        @click="breakdownOpen = true"
      >
        Из чего сложился
        <svg viewBox="0 0 16 16" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 3l5 5-5 5" />
        </svg>
      </button>
    </section>

    <!-- ═══ КОНТУР ОСЛЕП ═══
         Экран режима blind — не заглушка. Он называет ровно то, чего не
         хватает, в порядке того, сколько веса это вернёт в расчёт. -->
    <section
      v-if="charge.mode === 'blind'"
      class="rounded-[20px] border px-5 py-5"
      :style="{ background: 'var(--sig-unknown-fill)', borderColor: 'var(--sig-unknown)' }"
    >
      <h2 class="font-brand text-[1.0625rem] font-semibold" :style="{ color: 'var(--sig-unknown-ink)' }">
        Считать нечем
      </h2>
      <p class="kh-balance mt-1.5 text-[0.875rem] leading-relaxed" :style="{ color: 'var(--sig-unknown-ink)' }">
        Число не показывается намеренно: балл, построенный на четверти входов,
        запоминается целиком, а оговорка рядом с ним — нет.
      </p>
      <ul class="mt-4 flex flex-col gap-3">
        <li v-for="m in charge.missing.slice(0, 4)" :key="m.key || m.title" class="flex gap-3">
          <span
            class="mt-[3px] block h-2 w-2 shrink-0 rounded-full"
            :style="{ background: 'var(--sig-unknown)' }"
            aria-hidden="true"
          ></span>
          <div class="min-w-0">
            <p class="text-[0.9375rem] font-medium" :style="{ color: 'var(--sig-unknown-ink)' }">{{ m.title }}</p>
            <p class="mt-0.5 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-secondary)' }">{{ m.why }}</p>
          </div>
        </li>
      </ul>
    </section>

    <!-- ═══ РАЗДЕЛЫ ПЛИТКАМИ (решение владельца 30.08.2026) ═══
         Приём перенесён с пульта «Бумбастика»: карточки в два столбца, у
         каждой имя раздела и одна строка «что там». Нижнее меню никуда не
         делось — плитки дублируют его нарочно.

         ⚠ Дублирование здесь не избыточность. Капсула внизу — это «куда
         перейти», плитки — «что вообще есть»: на первый экран человек
         попадает каждый раз, а иконки в капсуле подписаны одним словом и
         не говорят, что внутри. Разница видна на разделах, которые
         открывают редко. -->
    <section>
      <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]"
          :style="{ color: 'var(--text-muted)' }">Разделы</h2>
      <div class="grid grid-cols-2 gap-3">
        <button
          v-for="s in SECTIONS"
          :key="s.id"
          type="button"
          class="rounded-[18px] border px-4 py-4 text-left active:opacity-90"
          :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', boxShadow: 'var(--card-shadow)' }"
          @click="emit('go', s.id)"
        >
          <p class="text-[0.9375rem] font-semibold">{{ s.label }}</p>
          <p class="mt-1 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-muted)' }">{{ s.hint }}</p>
        </button>
      </div>

      <!-- ⛔ «Риски» — ЭКРАН, а не ссылка на apps/risk/health-risk.html.
           Тот файл открытый, и в публичном репозитории он означал бы
           выложенные наружу тревоги и показатели. На телефоне его к тому же
           просто нет: он живёт на машине владельца. Здесь те же данные, но
           из health.json, то есть за входом. -->
      <button
        type="button"
        class="mt-3 flex w-full items-center justify-between rounded-[18px] border px-5 py-4 text-left active:opacity-90"
        :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', boxShadow: 'var(--card-shadow)' }"
        @click="emit('go', 'risk')"
      >
        <span>
          <span class="block text-[0.9375rem] font-semibold">Контроль рисков</span>
          <span class="mt-1 block text-[0.8125rem]" :style="{ color: 'var(--text-muted)' }">
            светофор органов, тревоги с исходами, точность контура
          </span>
        </span>
        <span class="ml-3 shrink-0 text-[1.25rem]" :style="{ color: 'var(--text-muted)' }">›</span>
      </button>
    </section>

    <!-- ═══ ВОСКРЕСНАЯ ОТМЕТКА ═══ -->
    <button
      v-if="!weekFilled"
      type="button"
      class="flex w-full items-center gap-4 rounded-[20px] border px-5 py-4 text-left active:opacity-90"
      :style="isSurveyDue
        ? { background: 'var(--action)', borderColor: 'var(--action)', color: 'var(--action-ink)' }
        : { background: 'var(--surface)', borderColor: 'var(--rim)', boxShadow: 'var(--card-shadow)' }"
      @click="emit('open-survey')"
    >
      <svg viewBox="0 0 24 24" class="h-6 w-6 shrink-0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 9.5h17M8 3v4M16 3v4" />
        <path d="M8.5 14.5l2 2 4-4.5" />
      </svg>
      <span class="min-w-0 flex-1">
        <span class="block font-brand text-[1.0625rem] font-semibold">
          {{ isSurveyDue ? 'Воскресная отметка' : 'Неделя не отмечена' }}
        </span>
        <span
          class="mt-0.5 block text-[0.8125rem] leading-snug"
          :style="{ color: isSurveyDue ? 'var(--ink-on-color-muted)' : 'var(--text-muted)' }"
        >
          Тридцать пунктов из девяноста — симптомы и экспозиция. Без отметки они не считаются.
        </span>
      </span>
      <svg viewBox="0 0 16 16" class="h-4 w-4 shrink-0 opacity-60" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 3l5 5-5 5" />
      </svg>
    </button>

    <!-- ═══ ЧТО СЕЙЧАС ОТКРЫТО ═══ -->
    <section v-if="openAlerts.length">
      <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
        Открытые тревоги
      </h2>
      <div class="flex flex-col gap-2">
        <article
          v-for="a in openAlerts"
          :key="a.code"
          class="rounded-[16px] border px-4 py-3.5"
          :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
        >
          <div class="flex items-center gap-2">
            <span class="font-mono text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">{{ a.code }}</span>
            <StatusChip level="alarm" :label="a.organ_label.split(' ')[1] || a.organ_label" size="sm" />
          </div>
          <p class="mt-2 text-[0.9375rem] font-medium leading-snug">{{ a.title }}</p>
          <p v-if="a.doctor" class="mt-1.5 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-secondary)' }">
            {{ a.doctor }}
          </p>
        </article>
      </div>
    </section>

    <!-- ═══ ГРАНИЦА КОНТУРА ═══
         Не мелкий шрифт в подвале, а карточка на главном экране. Каждый
         экран приложения обязан помнить, чем оно не является. -->
    <section
      class="rounded-[16px] border px-4 py-3.5"
      :style="{ background: 'var(--surface-2)', borderColor: 'var(--line)' }"
    >
      <p class="text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-secondary)' }">
        <strong :style="{ color: 'var(--text)' }">Контур не назначает и не отменяет препараты</strong>
        и не ставит диагнозов. Он показывает, что видно в данных, и к какому врачу с этим идти.
        Последний забор — {{ fmtDate(data.last_draw) }}, {{ humanAge(lastDrawAge) }} назад.
      </p>
    </section>

    <!-- ═══ РАЗБОР БАЛЛА ═══ -->
    <BottomSheet
      :open="breakdownOpen"
      title="Из чего сложился заряд"
      :subtitle="`Метод ${charge.method}. Сумма весов ${charge.totalWeight}, в расчёте участвует ${charge.availableWeight}.`"
      @close="breakdownOpen = false"
    >
      <p class="kh-balance mb-4 text-[0.875rem] leading-relaxed" :style="{ color: 'var(--text-secondary)' }">
        Каждая строка — сколько пунктов из ста съел этот компонент. Веса заданы заранее
        и лежат в коде открытым текстом: балл, у которого веса не названы, проверить нельзя.
      </p>

      <ul class="flex flex-col gap-2.5">
        <li
          v-for="p in counted"
          :key="p.key"
          class="rounded-[14px] border px-4 py-3"
          :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
        >
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-[0.9375rem] font-medium">{{ p.full }}</span>
            <span class="shrink-0 font-mono text-[0.9375rem] tabular-nums" :style="{ color: p.points > 4 ? 'var(--sig-alarm)' : 'var(--text-muted)' }">
              −{{ p.points }}
            </span>
          </div>
          <!-- Полоса — доля веса компонента, залитая часть — то, что он потерял. -->
          <div class="mt-2 h-1.5 overflow-hidden rounded-full" :style="{ background: 'var(--surface-2)' }">
            <div
              class="h-full rounded-full"
              :style="{
                width: `${Math.round((p.severity || 0) * 100)}%`,
                background: p.severity > 0.5 ? 'var(--sig-alarm)' : (p.severity > 0.2 ? 'var(--sig-watch)' : 'var(--sig-ok)'),
              }"
            ></div>
          </div>
          <p class="mt-1.5 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
            вес {{ p.weight }} из {{ charge.totalWeight }}
            <template v-if="p.kind === 'system' && p.detail">
              · вне цели {{ Math.round((p.detail.off ?? 0) * 100) }}%
              <template v-if="p.detail.unknown"> · не измерялось {{ Math.round(p.detail.unknown * 100) }}%</template>
            </template>
            <template v-else-if="p.kind === 'trend' && p.detail">
              · уходят от цели: {{ p.detail.away.length }}
            </template>
          </p>
        </li>
      </ul>

      <template v-if="skipped.length">
        <h3 class="mb-2 mt-6 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
          Не участвует в расчёте
        </h3>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="p in skipped"
            :key="p.key"
            class="flex items-center justify-between gap-3 rounded-[12px] px-4 py-2.5"
            :style="{ background: 'var(--surface-2)' }"
          >
            <span class="text-[0.875rem]" :style="{ color: 'var(--text-secondary)' }">{{ p.full }}</span>
            <span class="shrink-0 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">нет данных</span>
          </li>
        </ul>
        <p class="mt-3 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
          Компонент без данных исключён, а веса остальных пересчитаны. Балл от этого не падает —
          падает полнота: непроверенный показатель не делает тело хуже, он делает картину слепее.
        </p>
      </template>
    </BottomSheet>
  </div>
</template>
