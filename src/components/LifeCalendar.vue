<script setup>
/*
  КАЛЕНДАРЬ ЖИЗНИ. Точка = одна неделя, от рождения до верха ЦЕЛЕВОЙ вилки.

  Образец визуальной системы — ряд дней месяца на экране «Прогресс» в
  gderost (`app/src/components/daily/MonthStrip.vue`): деления одинаковой
  ширины, зазор в 3 px, цвет несёт состояние. Оттуда же перенесён урок,
  записанный там комментарием: «на двух пикселях границы делений сливались,
  и месяц читался сплошной лентой вместо тридцати одного дня». Здесь делений
  не тридцать, а больше двух тысяч, поэтому зазор нужен ещё сильнее — иначе
  жизнь читается серым прямоугольником.

  ⚠ МАСШТАБ ПЕРЕДЕЛАН ПОД ЖИЗНЬ. В gderost ряд — про деньги по дням, и
  высота деления несёт величину. Здесь величины нет вовсе: у недели есть
  только состояние, и все точки одного размера. Ряд превращён в сетку по
  52 колонки — год в строке; так видно и десятилетия, и отдельную неделю.

  Четыре тона (⛔ и ни одного больше — пятый читатель уже не различит):
    · ЗЕЛЁНАЯ  — неделя, в которой прошёл воскресный разбор;
    · тусклая  — прожитая без разбора;
    · светлая  — впереди, в пределах текущей вилки;
    · бледная  — впереди, между текущей и целевой вилкой: то, что на столе.

  ⛔ ЗАДНИМ ЧИСЛОМ НЕ ЗАКРАШИВАЕТСЯ НИЧЕГО (Д-42). До первого разбора зелёных
  точек ноль. Это честно и это мотивирует: пустая сетка — единственный
  счётчик, который нельзя выдумать.

  ⛔ Ни одна точка не несёт медицинского смысла. Календарь показывает
  дисциплину, а не самочувствие: в нём нет ни симптомов, ни показателей —
  только «была неделя закрыта разбором или нет» (docs/PUBLIC-WHITELIST.md).
*/
import { computed } from 'vue'

const props = defineProps({
  born: { type: String, required: true },
  lived: { type: Number, required: true },
  toCurrentHi: { type: Number, default: 0 },
  toTargetHi: { type: Number, default: 0 },
  reviewed: { type: Array, default: () => [] },
})

const COLS = 52

/** ISO-неделя для номера недели жизни N (0 — неделя рождения). */
function isoOfWeek(n) {
  const d = new Date(props.born + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n * 7)
  // ISO-номер: четверг той же недели определяет год
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const num = Math.ceil(((t - start) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(num).padStart(2, '0')}`
}

const reviewedSet = computed(() => new Set(props.reviewed))

const total = computed(() => props.lived + Math.max(props.toTargetHi, props.toCurrentHi))

const weeks = computed(() => {
  const out = []
  const endCurrent = props.lived + props.toCurrentHi
  for (let i = 0; i < total.value; i += 1) {
    let kind
    if (i < props.lived) kind = reviewedSet.value.has(isoOfWeek(i)) ? 'review' : 'lived'
    else if (i < endCurrent) kind = 'ahead'
    else kind = 'target'
    out.push(kind)
  }
  return out
})

const rows = computed(() => {
  const r = []
  for (let i = 0; i < weeks.value.length; i += COLS) {
    r.push({ year: Math.floor(i / COLS), cells: weeks.value.slice(i, i + COLS) })
  }
  return r
})

const counts = computed(() => ({
  review: weeks.value.filter((w) => w === 'review').length,
  lived: props.lived,
  onTable: Math.max(0, props.toTargetHi - props.toCurrentHi),
}))
</script>

<template>
  <div class="cal">
    <div class="grid" role="img"
         :aria-label="`Календарь жизни: прожито ${counts.lived} недель, с разбором ${counts.review}`">
      <div v-for="(row, i) in rows" :key="i" class="row">
        <!-- Подпись каждые пять лет: чаще — шум, реже — теряется опора. -->
        <span class="age" :class="{ show: row.year % 5 === 0 }">{{ row.year }}</span>
        <span v-for="(c, j) in row.cells" :key="j" class="wk" :class="c"></span>
      </div>
    </div>

    <div class="legend">
      <span><i class="wk review"></i>неделя с разбором — {{ counts.review }}</span>
      <span><i class="wk lived"></i>прожита без разбора</span>
      <span><i class="wk ahead"></i>впереди</span>
      <span><i class="wk target"></i>на столе</span>
    </div>

    <p v-if="counts.review === 0" class="none">
      Зелёных недель пока ноль: первый воскресный разбор ещё не прошёл.
      Задним числом они не закрашиваются.
    </p>
  </div>
</template>

<style scoped>
.cal { margin-top: 6px; }
.grid { display: flex; flex-direction: column; gap: 3px; }
.row { display: flex; align-items: center; gap: 3px; }
.age {
  width: 18px; flex: 0 0 18px; font-size: 9px; line-height: 1;
  color: var(--text-muted); text-align: right; opacity: 0;
  font-variant-numeric: tabular-nums;
}
.age.show { opacity: 1; }
/* Зазор 3 px, как в ряде дней gderost: на двух пикселях соседние деления
   сливаются, и сетка читается сплошной заливкой вместо отдельных недель. */
.wk {
  flex: 1 1 0; min-width: 0; aspect-ratio: 1;
  border-radius: 1px; display: block;
}
.wk.review { background: var(--wk-review); }
.wk.lived { background: var(--wk-lived); }
.wk.ahead { background: var(--wk-ahead); }
.wk.target { background: var(--wk-target); }

.legend {
  display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 12px;
  font-size: 12px; color: var(--text-muted);
}
.legend span { display: inline-flex; align-items: center; gap: 5px; }
.legend i { width: 9px; height: 9px; flex: 0 0 9px; border-radius: 1px; }
.none { margin: 10px 0 0; font-size: 12.5px; color: var(--text-muted); }
</style>
