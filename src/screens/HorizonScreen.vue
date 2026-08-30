<script setup>
/*
  «ГОРИЗОНТ» — внутренняя половина технологии SYS-17, подраздел «Прогресса».

  ⚠ ПОЧЕМУ ЗДЕСЬ, А НЕ ШЕСТОЙ ВКЛАДКОЙ. В App.vue записано, почему вкладок
  пять: шестая перестаёт читаться, и первой перестаёт читаться та, что реже
  открывают. «Прогресс» — раздел про ВРЕМЯ (недели, ряд «Заряда»), и горизонт
  с рычагами — про то же время, только на другой дистанции. Ставить его
  отдельной вкладкой значило бы нарушить своё же правило ради одного экрана.

  ⛔ Сама вилка лет живёт на ПУБЛИЧНОЙ странице, до входа (Д-41/Д-43): там
  число и объяснение метода. Здесь то, что закрыто: рычаги с факторами
  поимённо, откуда взят каждый коэффициент, и чего в модели нет.

  ⛔ ГРАНИЦА КОНТУРА (docs/STANDARD-safety.md). Рычаг называется ПОКАЗАТЕЛЕМ,
  а не действием: «АД в личной цели», а не «принимайте». Препараты в
  сценариях не упоминаются вовсе, путь к цели — врач. Ловит дым.

  ⛔ «НЕ УЧТЕНО» — не подвал, а полноправный блок, и Lp(a) в нём первым
  (уточнение владельца 29.08.2026): фактор известен как значимый, это
  центральный факт тревоги Т-3, но количественной оценки в модели нет.
  Молча пропущенное читается как «этого нет», а оно есть.
*/
import { computed } from 'vue'
import ReadingBlocks from '../components/ReadingBlocks.vue'

const props = defineProps({
  life: { type: Object, default: () => ({}) },
  onboarding: { type: Object, default: () => ({ sections: [] }) },
  reviewed: { type: Array, default: () => [] },
  streak: { type: Number, default: 0 },
})

const levers = computed(() => props.life?.on_the_table?.levers || [])
const notIncluded = computed(() => props.life?.not_included || [])
const provenance = computed(() => props.life?.provenance || [])
const basis = computed(() => props.life?.basis || {})
const ott = computed(() => props.life?.on_the_table || {})
</script>

<template>
  <div v-if="!life || !life.horizon_current" class="up-card">
    <p class="up-muted" style="margin:0;font-size:13.5px">
      Прогон «Горизонта» ещё не собран. Данные готовит
      <code>python3 tools/life.py</code> в контуре.
    </p>
  </div>

  <template v-else>
    <div class="up-sec">Годы на столе</div>
    <section class="up-card">
      <div class="sum">
        <span class="big up-digit">+{{ ott.years }}</span>
        <span class="range up-muted">[{{ ott.years_lo }}–{{ ott.years_hi }}] лет</span>
      </div>
      <p class="lead up-muted">
        Разность двух вилок, посчитанных одной машинкой на одном базисе.
        В разности сокращается то, что смещает обе, поэтому ей можно верить
        сильнее, чем абсолютному числу.
      </p>

      <div v-for="l in levers" :key="l.key" class="lev">
        <div class="top">
          <span class="txt">{{ l.text }}</span>
          <span class="years up-digit">+{{ l.years }}
            <i>[{{ l.years_lo }}–{{ l.years_hi }}]</i></span>
        </div>
        <div class="meta up-muted">
          {{ l.from }} → {{ l.to }} {{ l.unit }}
          <template v-if="l.fact_date"> · факт {{ l.fact_date }}</template>
          <template v-if="l.stale"> · ⚠ устарел</template>
          <template v-if="l.codes && l.codes.length"> · {{ l.codes.join(', ') }}</template>
        </div>
      </div>

      <p class="bound up-muted">
        ⛔ Контур не назначает и не отменяет. Рычаг назван показателем; как его
        двигать — разговор с врачом, а не с этим экраном.
      </p>
    </section>

    <div class="up-sec">Не учтено в модели</div>
    <section class="up-card">
      <div v-for="n in notIncluded" :key="n.key" class="ni">
        <h3>{{ n.name }}</h3>
        <p class="fact">{{ n.fact }}</p>
        <p class="why up-muted"><b>Почему:</b> {{ n.why }}</p>
        <p class="why up-muted"><b>Вес:</b> {{ n.weight }}</p>
      </div>
    </section>

    <div class="up-sec">Откуда числа</div>
    <section class="up-card">
      <div v-for="p in provenance" :key="p.factor" class="prov">
        <div class="ptop">
          <span>{{ p.name }}</span>
          <span class="up-muted up-digit">{{ p.value }} {{ p.unit }}</span>
        </div>
        <p class="src">{{ p.source }}</p>
        <p class="up-muted small">
          сверено {{ p.checked }}<template v-if="p.date"> · факт {{ p.date }}</template>
          <template v-if="p.stale"> · ⚠ устарел</template>
        </p>
      </div>
      <p class="bound up-muted">Базис — {{ basis.table }}. {{ basis.note }}</p>
    </section>

    <div class="up-sec">Разборы</div>
    <section class="up-card">
      <div class="trow">
        <span class="up-muted">Недель в зачёте подряд</span>
        <span class="up-digit">{{ streak }}</span>
      </div>
      <div class="trow">
        <span class="up-muted">Разборов проведено</span>
        <span class="up-digit">{{ reviewed.length }}</span>
      </div>
      <p v-if="!reviewed.length" class="bound up-muted">
        Ни одного разбора пока не проведено. Первый закрасит первую неделю
        в календаре. ⛔ Задним числом недели не закрашиваются — пустая неделя
        не упрёк, а единственный способ, которым счётчик остаётся правдой.
      </p>
      <div v-else class="weeks">
        <span v-for="w in [...reviewed].reverse()" :key="w" class="wk up-digit">{{ w }}</span>
      </div>
    </section>

    <div class="up-sec">Как читать Горизонт</div>
    <section class="up-card">
      <p class="lead up-muted">
        Здесь внутренняя половина: конкретные величины и их источники.
        Метод — на странице до входа, рядом с самой вилкой.
      </p>
      <ReadingBlocks :sections="onboarding.sections || []" />
    </section>
  </template>
</template>

<style scoped>
.sum { display: flex; align-items: baseline; gap: 10px; }
.big { font-size: 34px; font-weight: 700; line-height: 1; }
.range { font-size: 13px; }
.lead { margin: 8px 0 14px; font-size: 13px; line-height: 1.5; }

.lev { padding-top: 12px; margin-top: 12px; border-top: 1px solid var(--line); }
.top { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
.txt { font-size: 14.5px; font-weight: 600; }
.years { font-size: 17px; font-weight: 700; white-space: nowrap; }
.years i { font-style: normal; font-size: 11.5px; color: var(--text-muted); font-weight: 500; }
.meta { font-size: 12px; margin-top: 3px; }

.ni + .ni { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }
.ni h3 { margin: 0; font-size: 14.5px; font-weight: 600; }
.fact { margin: 3px 0 0; font-size: 13px; }
.why { margin: 5px 0 0; font-size: 12.5px; line-height: 1.45; }

.prov + .prov { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
.ptop { display: flex; justify-content: space-between; gap: 10px; font-size: 14px; font-weight: 600; }
.src { margin: 4px 0 0; font-size: 12px; color: var(--text-secondary); line-height: 1.45; }
.small { font-size: 11.5px; margin: 3px 0 0; }

.trow { display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; }
.weeks { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.wk {
  font-size: 11.5px; padding: 3px 8px; border-radius: 999px;
  color: var(--sig-ok-ink); background: var(--sig-ok-fill);
}
.bound { margin: 14px 0 0; font-size: 12px; line-height: 1.45; }
code { font-size: 12px; background: var(--surface-2); padding: 1px 4px; border-radius: 4px; }
</style>
