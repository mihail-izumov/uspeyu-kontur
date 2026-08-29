<script setup>
import { computed } from 'vue'

/* Кольцо «Заряда».
 *
 * Три состояния, и они РАЗНЫЕ ПО ФОРМЕ, а не по цвету, потому что говорят
 * принципиально разное:
 *
 *   exact  — сплошная дуга и целое число. Контур видит достаточно.
 *   range  — дуга с размытым концом и диапазон «71–80». Контур видит
 *            частично, и ширина диапазона показывает, насколько частично.
 *   blind  — пунктирное кольцо и прочерк вместо числа. Контур не видит.
 *
 * ⛔ ПОЧЕМУ В РЕЖИМЕ blind ЧИСЛА НЕТ ВООБЩЕ. Соблазн показать «примерно 70,
 *   но мы не уверены» велик: пустой экран выглядит поломанным. Но число,
 *   один раз увиденное, дальше живёт само по себе — через неделю человек
 *   помнит «семьдесят», а не оговорку рядом с ним. Поэтому вместо числа
 *   стоит прочерк и список того, чего не хватает: это и честно, и полезнее,
 *   потому что называет следующий шаг.
 *
 * Цвет дуги — по величине, а не по настроению:
 *   ≥75 — «в цели», 50…74 — «отклонение», <50 — «внимание».
 * Дублируется подписью под числом, потому что цвет не может быть
 * единственным носителем смысла.
 */
const props = defineProps({
  value: { type: Number, default: null },
  low: { type: Number, default: null },
  high: { type: Number, default: null },
  mode: { type: String, default: 'blind' }, // exact | range | blind
  confidence: { type: Number, default: 0 },
  delta: { type: Object, default: null },
  size: { type: Number, default: 220 },
})

const R = 44
const C = 2 * Math.PI * R

const level = computed(() => {
  if (props.mode === 'blind' || props.value === null) return 'unknown'
  if (props.value >= 75) return 'ok'
  if (props.value >= 50) return 'watch'
  return 'alarm'
})

const word = computed(() => ({
  ok: 'запас есть',
  watch: 'под нагрузкой',
  alarm: 'нагрузка высокая',
  unknown: 'нечем считать',
}[level.value]))

// Дуга рисуется от 12 часов по часовой стрелке. Для режима range заполняется
// нижняя граница диапазона — обещать верхнюю значило бы показать лучшее из
// возможного как факт.
const shown = computed(() => {
  if (props.mode === 'blind') return 0
  if (props.mode === 'range') return props.low ?? props.value ?? 0
  return props.value ?? 0
})
const dashOffset = computed(() => C - (C * Math.min(100, Math.max(0, shown.value))) / 100)
const stroke = computed(() => `var(--sig-${level.value})`)
</script>

<template>
  <div class="flex flex-col items-center">
    <div class="relative" :style="{ width: `${size}px`, height: `${size}px` }">
      <svg :viewBox="`0 0 100 100`" class="h-full w-full -rotate-90" aria-hidden="true">
        <!-- Дорожка. В режиме blind она пунктирная: разрывы и есть пробелы. -->
        <circle
          cx="50" cy="50" :r="R"
          fill="none"
          :stroke="mode === 'blind' ? 'var(--sig-unknown)' : 'var(--line)'"
          stroke-width="7"
          :stroke-dasharray="mode === 'blind' ? '2 8' : undefined"
          stroke-linecap="round"
        />
        <circle
          v-if="mode !== 'blind'"
          class="kh-ring"
          cx="50" cy="50" :r="R"
          fill="none"
          :stroke="stroke"
          stroke-width="7"
          stroke-linecap="round"
          :stroke-dasharray="C"
          :stroke-dashoffset="dashOffset"
        />
        <!-- Хвост диапазона: та же дуга, но полупрозрачная — от нижней
             границы до верхней. Видно, где число «может быть», а где точно. -->
        <circle
          v-if="mode === 'range' && high !== null"
          cx="50" cy="50" :r="R"
          fill="none"
          :stroke="stroke"
          stroke-width="7"
          stroke-linecap="round"
          opacity="0.28"
          :stroke-dasharray="C"
          :stroke-dashoffset="C - (C * Math.min(100, high)) / 100"
        />
      </svg>

      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <template v-if="mode === 'exact'">
          <span class="kh-digit font-brand text-[3.75rem] font-semibold tabular-nums" :style="{ color: 'var(--text)' }">
            {{ value }}
          </span>
        </template>
        <template v-else-if="mode === 'range'">
          <span class="kh-digit font-brand text-[2.5rem] font-semibold tabular-nums" :style="{ color: 'var(--text)' }">
            {{ low }}<span :style="{ color: 'var(--text-muted)' }">–</span>{{ high }}
          </span>
        </template>
        <template v-else>
          <span class="kh-digit font-brand text-[3rem] font-semibold" :style="{ color: 'var(--sig-unknown)' }">—</span>
        </template>

        <span
          class="mt-2 font-label text-[0.6875rem] uppercase tracking-[0.16em]"
          style="margin-right: -0.16em"
          :style="{ color: `var(--sig-${level})` }"
        >{{ word }}</span>
      </div>
    </div>

    <!-- Дельта против прошлой недели. Меньше четырёх пунктов — «без
         изменений»: шум шкалы не должен читаться как движение. -->
    <p
      v-if="delta && mode !== 'blind'"
      class="mt-3 text-[0.875rem]"
      :style="{ color: delta.dir === 'flat' ? 'var(--text-muted)' : (delta.dir === 'up' ? 'var(--sig-ok)' : 'var(--sig-alarm)') }"
    >
      {{ delta.text }} <span :style="{ color: 'var(--text-muted)' }">против прошлой недели</span>
    </p>
  </div>
</template>
