<script setup>
/* График ряда одного показателя. SYS-5 (Д-31, 29.08.2026).
 *
 * ⛔ Свой SVG вместо uPlot/Chart.js — решение, а не экономия:
 *    - jsdom дымовой проверки не умеет canvas, а весь CI стоит на ней;
 *    - зависимостей ноль — нечему протухать и нечего лицензировать;
 *    - интерактив тут не нужен (владелец 29.08.2026: приложение — витрина
 *      медкарты, «интерактив минимум»), значит вся сила библиотек — мимо.
 *
 * ⛔ График рисуется только при ДВУХ и более точках. Одна точка — не ряд.
 *    Стрелку направления рисует родитель и только при ≥3 точках (Д-5) —
 *    здесь линия по двум точкам допустима, потому что это факт «было-стало»,
 *    а не утверждение о тренде.
 *
 * Ось X — пропорциональна времени. Равные шаги между неравными интервалами
 * (2018 → 2022 → 2024) рисовали бы ложную равномерность ряда.
 */
import { computed } from 'vue'

const props = defineProps({
  points: { type: Array, required: true },     // [[iso-дата, число], ...]
  refRange: { type: String, default: '' },     // «62–106» | «<30» | «≥90»
  target: { type: String, default: '' },       // личная цель, тот же формат
  unit: { type: String, default: '' },
})

const W = 320
const H = 116
const PAD = { l: 8, r: 8, t: 10, b: 22 }

const pts = computed(() =>
  (props.points || [])
    .map(([d, v]) => ({ t: Date.parse(d), v: Number(v) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t),
)

/* «62–106» → [62,106] · «<30» → [null,30] · «≥90» → [90,null].
 * Запятая — десятичная. Мусор → [null,null], полоса не рисуется. */
function parseRange(s) {
  if (!s) return [null, null]
  const c = String(s).replace(/,/g, '.').replace(/−/g, '-')
  let m = c.match(/^([\d.]+)\s*[–-]\s*([\d.]+)/)
  if (m) return [Number(m[1]), Number(m[2])]
  m = c.match(/^[<≤]\s*([\d.]+)/)
  if (m) return [null, Number(m[1])]
  m = c.match(/^[>≥]\s*([\d.]+)/)
  if (m) return [Number(m[1]), null]
  return [null, null]
}

const ref = computed(() => parseRange(props.refRange))
const goal = computed(() => parseRange(props.target))

/* Диапазон Y обнимает и точки, и референс, и цель — иначе полоса нормы
 * может оказаться за краем и график соврёт «всё в порядке». */
const domain = computed(() => {
  const vals = pts.value.map((p) => p.v)
  for (const b of [...ref.value, ...goal.value]) if (b !== null) vals.push(b)
  let lo = Math.min(...vals)
  let hi = Math.max(...vals)
  if (lo === hi) { lo -= 1; hi += 1 }
  const padY = (hi - lo) * 0.12
  return [lo - padY, hi + padY]
})

const x = (t) => {
  const t0 = pts.value[0].t
  const t1 = pts.value[pts.value.length - 1].t
  if (t1 === t0) return W / 2
  return PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r)
}
const y = (v) => {
  const [lo, hi] = domain.value
  return PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b)
}

const path = computed(() =>
  pts.value.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' '),
)

/* Полоса референса: прямоугольник от нижней границы до верхней; открытые
 * границы («<30») упираются в край графика. */
const band = computed(() => {
  const [lo, hi] = ref.value
  if (lo === null && hi === null) return null
  const [dLo, dHi] = domain.value
  const topV = hi === null ? dHi : hi
  const botV = lo === null ? dLo : lo
  return { y: y(topV), h: Math.max(0, y(botV) - y(topV)) }
})

/* Цель — одна пунктирная линия по «рабочей» границе: у «≤x» это x,
 * у «≥x» это x, у коридора — обе. */
const goalLines = computed(() =>
  goal.value.filter((v) => v !== null).map((v) => ({ v, y: y(v) })),
)

const yearFirst = computed(() => new Date(pts.value[0].t).getFullYear())
const yearLast = computed(() => new Date(pts.value[pts.value.length - 1].t).getFullYear())
const vMin = computed(() => Math.min(...pts.value.map((p) => p.v)))
const vMax = computed(() => Math.max(...pts.value.map((p) => p.v)))
const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100)
</script>

<template>
  <figure v-if="pts.length >= 2" class="m-0">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="block w-full"
      role="img"
      :aria-label="`Ряд из ${pts.length} точек, ${yearFirst}–${yearLast}, от ${fmt(vMin)} до ${fmt(vMax)} ${unit}`"
    >
      <!-- полоса референса лаборатории -->
      <rect
        v-if="band"
        :x="PAD.l" :y="band.y" :width="W - PAD.l - PAD.r" :height="band.h"
        rx="3"
        style="fill: var(--sig-ok); opacity: 0.1"
      />
      <!-- личная цель -->
      <line
        v-for="g in goalLines"
        :key="g.v"
        :x1="PAD.l" :x2="W - PAD.r" :y1="g.y" :y2="g.y"
        stroke-dasharray="5 4" stroke-width="1.25"
        style="stroke: var(--sig-alarm); opacity: 0.65"
      />
      <!-- линия ряда -->
      <path :d="path" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke: var(--text)" />
      <!-- точки заборов -->
      <circle
        v-for="p in pts" :key="p.t"
        :cx="x(p.t)" :cy="y(p.v)" r="3.2"
        style="fill: var(--surface); stroke: var(--text); stroke-width: 1.8"
      />
      <!-- годы по краям: время неравномерно, честнее подписать края, чем сетку -->
      <text :x="PAD.l" :y="H - 6" class="ax">{{ yearFirst }}</text>
      <text :x="W - PAD.r" :y="H - 6" text-anchor="end" class="ax">{{ yearLast }}</text>
    </svg>
    <figcaption class="mt-1 flex justify-between text-[0.6875rem]" :style="{ color: 'var(--text-muted)' }">
      <span>{{ pts.length }} точек · {{ fmt(vMin) }}–{{ fmt(vMax) }} {{ unit }}</span>
      <span v-if="goalLines.length">– – цель · полоса — референс</span>
      <span v-else-if="band">полоса — референс</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.ax {
  font-size: 10px;
  fill: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
