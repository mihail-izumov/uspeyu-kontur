<script setup>
import { computed, ref } from 'vue'
import BottomSheet from '../components/BottomSheet.vue'
import HorizonScreen from './HorizonScreen.vue'
import StatusChip from '../components/StatusChip.vue'
import { exportWeek, fmtWeekRange, weekSunday } from '../composables/useWeekly.js'

/* «Прогресс» — раздел, куда ложатся воскресные отметки и сводки недель.
 *
 * ⚠ ЧТО ЗДЕСЬ СЧИТАЕТСЯ ПРОГРЕССОМ. Не «стало лучше», а «ряд стал длиннее».
 * Bioniq показывает прогресс только со второго чек-апа, и по той же причине
 * здесь линия «Заряда» рисуется от двух отметок, а выводы о связях —
 * не раньше, чем наберётся столько недель, сколько назначено гипотезе в
 * weekly/weekly_2026.md (12, 16, 26, 52 — у каждой свой минимум).
 *
 * ⛔ ПРИЛОЖЕНИЕ НЕ ОБЪЯВЛЯЕТ СВЯЗЕЙ. Соблазн написать «на неделях с алкоголем
 * боль выше» появится на пятой неделе ряда и будет ложным: правило контура —
 * гипотеза становится рабочей только после того, как предскажет что-то
 * ЗАРАНЕЕ и предсказание сбудется. До тех пор экран показывает ряды рядом
 * друг с другом и молчит.
 */
const props = defineProps({
  weeks: { type: Array, required: true },
  series: { type: Array, default: () => [] },
  pendingExport: { type: Array, default: () => [] },
  currentWeek: { type: String, required: true },
  chargeMethod: { type: String, default: '' },
  /* Д-45: «Горизонт» — второй подраздел этого экрана. Данные приезжают
     готовыми из генератора, приложение их не считает (Д-29). */
  life: { type: Object, default: () => ({}) },
  onboarding: { type: Object, default: () => ({ sections: [] }) },
  reviewed: { type: Array, default: () => [] },
  streak: { type: Number, default: 0 },
})

/* ⚠ Подразделы, а не шестая вкладка. В App.vue записано, почему вкладок
   пять. «Прогресс» — раздел про ВРЕМЯ: недели это ближняя дистанция,
   горизонт — дальняя. Приём тот же, что у «Задач» внутри «Данных». */
const SUB = [
  { id: 'weeks', label: 'Недели' },
  { id: 'horizon', label: 'Горизонт' },
]
const sub = ref('weeks')
const emit = defineEmits(['open-survey'])

const exporting = ref(null)
const copied = ref(false)

const chart = computed(() => props.series.slice(-16))
const maxCharge = 100

/* Сводка недели человеческим языком. Собирается из полей мастера, БЕЗ
 * интерпретации: перечисляется то, что записано, а не то, что из этого
 * следует. «Приступ был» — факт; «подагра обостряется» — вывод, и его здесь
 * нет. */
function summarize(w) {
  const f = w.fields || {}
  const bits = []
  if (f.who5 !== undefined) bits.push(`самочувствие ${f.who5}/100`)
  const pain = Math.max(f.pain_heel ?? 0, f.pain_ankle ?? 0)
  if (pain) bits.push(`боль ${pain}/10`)
  if (String(f.flare) === 'yes') bits.push('был приступ')
  if (f.arcoxia) bits.push(`НПВС ${f.arcoxia} дн.`)
  if (f.heartburn) bits.push(`изжога ${f.heartburn}/3`)
  if (f.alcohol) bits.push(`алкоголь ${f.alcohol}`)
  if (f.prostate) bits.push(`простата ${f.prostate}/10`)
  if (f.cold) bits.push(`холод ${f.cold} дн.`)
  return bits
}

function who5Level(v) {
  // Пороги ВОЗ: <50 — повод присмотреться, <28 — повод к разговору со
  // специалистом. Это скрининг самочувствия, а не диагноз, и подпись
  // сформулирована соответственно.
  if (v === undefined || v === null) return null
  if (v < 28) return { level: 'alarm', label: 'низкое — показать врачу' }
  if (v < 50) return { level: 'watch', label: 'сниженное' }
  return { level: 'ok', label: 'в норме' }
}

function openExport(w) {
  exporting.value = w
  copied.value = false
}

const exportText = computed(() =>
  exporting.value
    ? exportWeek(exporting.value.week, exporting.value.fields, { method: props.chargeMethod })
    : '',
)

async function copyExport() {
  try {
    await navigator.clipboard.writeText(exportText.value)
    copied.value = true
  } catch {
    // Clipboard API требует защищённого контекста и жеста пользователя.
    // Где его нет — текст всё равно на экране и выделяется руками.
    copied.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- ═══ ПОДРАЗДЕЛЫ ═══ (приём перенесён из «Данных») -->
    <div class="flex gap-1 rounded-full p-1" :style="{ background: 'var(--surface-2)' }">
      <button
        v-for="s in SUB"
        :key="s.id"
        type="button"
        class="min-h-[40px] flex-1 rounded-full text-[0.8125rem] active:opacity-70"
        :style="sub === s.id
          ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--card-shadow)' }
          : { color: 'var(--text-muted)' }"
        @click="sub = s.id"
      >{{ s.label }}</button>
    </div>

    <HorizonScreen
      v-if="sub === 'horizon'"
      :life="life"
      :onboarding="onboarding"
      :reviewed="reviewed"
      :streak="streak"
    />

    <template v-else>
    <!-- ═══ ЧТО НЕ ПЕРЕНЕСЕНО В МАСТЕР ═══
         Стоит первым и намеренно: отметка, оставшаяся только в телефоне,
         для контура не существует — по ней не проверить ни одну гипотезу. -->
    <section
      v-if="pendingExport.length"
      class="rounded-[20px] border px-5 py-4"
      :style="{ background: 'var(--sig-watch-fill)', borderColor: 'var(--sig-watch)' }"
    >
      <h2 class="font-brand text-[1.0625rem] font-semibold" :style="{ color: 'var(--sig-watch-ink)' }">
        {{ pendingExport.length }}
        {{ pendingExport.length === 1 ? 'отметка не перенесена' : 'отметки не перенесены' }} в контур
      </h2>
      <p class="kh-balance mt-1.5 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-secondary)' }">
        Пока отметка живёт только в телефоне, она не участвует в проверке гипотез
        и пропадёт при чистке браузера. Экспорт даёт готовый блок для weekly_2026.md.
      </p>
      <div class="mt-3 flex flex-col gap-2">
        <button
          v-for="w in pendingExport"
          :key="w.week"
          type="button"
          class="flex min-h-[48px] items-center justify-between gap-3 rounded-[12px] border px-4 text-left active:opacity-70"
          :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
          @click="openExport(w)"
        >
          <span class="font-mono text-[0.875rem]">{{ w.week }}</span>
          <span class="text-[0.8125rem]" :style="{ color: 'var(--action-text)' }">Экспорт</span>
        </button>
      </div>
    </section>

    <!-- ═══ РЯД «ЗАРЯДА» ═══ -->
    <section
      class="rounded-[20px] border px-5 py-5"
      :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', boxShadow: 'var(--card-shadow)' }"
    >
      <h2 class="font-brand text-[1.0625rem] font-semibold">Заряд по неделям</h2>

      <template v-if="chart.length >= 2">
        <!-- Столбики, а не линия. Линия соединяет точки и тем самым обещает,
             что между ними что-то измерялось; между двумя воскресеньями не
             измерялось ничего. -->
        <div class="mt-4 flex h-32 items-end gap-1">
          <div v-for="p in chart" :key="p.week" class="flex flex-1 flex-col items-center gap-1">
            <div class="flex w-full flex-1 items-end">
              <div
                class="w-full rounded-t-[4px]"
                :style="{
                  height: `${Math.max(4, (p.value / maxCharge) * 100)}%`,
                  background: p.value >= 75 ? 'var(--sig-ok)' : (p.value >= 50 ? 'var(--sig-watch)' : 'var(--sig-alarm)'),
                  opacity: p.mode === 'exact' ? 1 : 0.5,
                }"
                :title="`${p.week}: ${p.value}`"
              ></div>
            </div>
            <span class="text-[0.5625rem] tabular-nums" :style="{ color: 'var(--text-muted)' }">
              {{ p.week.slice(-2) }}
            </span>
          </div>
        </div>
        <p class="mt-2 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
          Полупрозрачный столбик — неделя, посчитанная при неполных данных.
        </p>
      </template>

      <p v-else class="kh-balance mt-3 text-[0.875rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
        Ряда пока нет: линия начинается со второй отметки. Одна точка — это не тренд,
        а отрезок, и рисовать по ней направление было бы выдумкой.
      </p>
    </section>

    <!-- ═══ НЕДЕЛИ ═══ -->
    <section>
      <div class="mb-2 flex items-center justify-between">
        <h2 class="font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
          Отметки
        </h2>
        <button
          type="button"
          class="min-h-[36px] text-[0.875rem] active:opacity-60"
          :style="{ color: 'var(--action-text)' }"
          @click="emit('open-survey')"
        >Отметить неделю</button>
      </div>

      <div v-if="!weeks.length" class="rounded-[20px] border px-5 py-6 text-center" :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }">
        <p class="text-[0.9375rem]">Ни одной отметки</p>
        <p class="kh-balance mx-auto mt-1.5 max-w-[22rem] text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
          Недельный слой — несущий, а не вспомогательный. Анализы раз в год покажут, где вы
          сейчас; недельный ряд покажет, от чего это зависит.
        </p>
      </div>

      <div v-else class="flex flex-col gap-2">
        <article
          v-for="w in weeks"
          :key="w.week"
          class="rounded-[16px] border px-4 py-3.5"
          :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-[0.875rem]">{{ w.week }}</span>
            <span class="text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">{{ fmtWeekRange(w.week) }}</span>
            <span v-if="w.week === currentWeek" class="text-[0.6875rem]" :style="{ color: 'var(--action-text)' }">текущая</span>
            <span class="ml-auto shrink-0">
              <StatusChip
                v-if="w.source === 'local'"
                level="watch"
                label="только в телефоне"
                size="sm"
              />
              <StatusChip v-else level="ok" label="в контуре" size="sm" />
            </span>
          </div>

          <div v-if="who5Level(w.fields.who5)" class="mt-2.5 flex items-center gap-2">
            <span class="font-mono text-[1.25rem] tabular-nums">{{ w.fields.who5 }}</span>
            <span class="text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">WHO-5</span>
            <StatusChip
              :level="who5Level(w.fields.who5).level"
              :label="who5Level(w.fields.who5).label"
              size="sm"
            />
          </div>

          <ul v-if="summarize(w).length" class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.8125rem]" :style="{ color: 'var(--text-secondary)' }">
            <li v-for="(b, i) in summarize(w)" :key="i">{{ b }}</li>
          </ul>

          <p v-if="w.fields.events" class="mt-2 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-secondary)' }">
            {{ w.fields.events }}
          </p>

          <button
            v-if="w.source === 'local'"
            type="button"
            class="mt-3 min-h-[36px] text-[0.8125rem] active:opacity-60"
            :style="{ color: 'var(--action-text)' }"
            @click="openExport(w)"
          >Экспорт в контур</button>
        </article>
      </div>
    </section>

    <!-- ═══ ГИПОТЕЗЫ ═══
         Список заведён ЗАРАНЕЕ, до данных, чтобы их нельзя было подогнать
         под результат. Здесь он показывается как счётчик: сколько недель
         нужно и сколько набралось. Никаких выводов до порога. -->
    <section
      class="rounded-[16px] border px-4 py-3.5"
      :style="{ background: 'var(--surface-2)', borderColor: 'var(--line)' }"
    >
      <h2 class="font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
        Что ищет контур в этом ряду
      </h2>
      <ul class="mt-2.5 flex flex-col gap-2 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-secondary)' }">
        <li class="flex items-baseline justify-between gap-3">
          <span>Алкоголь предшествует боли · Н-3</span>
          <span class="shrink-0 font-mono tabular-nums" :style="{ color: 'var(--text-muted)' }">{{ weeks.length }}/12</span>
        </li>
        <li class="flex items-baseline justify-between gap-3">
          <span>Изжога усиливается после НПВС · Н-6</span>
          <span class="shrink-0 font-mono tabular-nums" :style="{ color: 'var(--text-muted)' }">{{ weeks.length }}/12</span>
        </li>
        <li class="flex items-baseline justify-between gap-3">
          <span>Вода защищает · Н-4</span>
          <span class="shrink-0 font-mono tabular-nums" :style="{ color: 'var(--text-muted)' }">{{ weeks.length }}/16</span>
        </li>
        <li class="flex items-baseline justify-between gap-3">
          <span>Холод защищает — загадка моржевания · Н-1</span>
          <span class="shrink-0 font-mono tabular-nums" :style="{ color: 'var(--text-muted)' }">{{ weeks.length }}/сезон</span>
        </li>
        <li class="flex items-baseline justify-between gap-3">
          <span>У подагры есть сезон · Н-8</span>
          <span class="shrink-0 font-mono tabular-nums" :style="{ color: 'var(--text-muted)' }">{{ weeks.length }}/52</span>
        </li>
      </ul>
      <p class="mt-3 text-[0.75rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
        Ни одна связь не считается доказанной по совпадению. Гипотеза переходит в
        «работает» только после того, как предскажет что-то заранее и предсказание сбудется.
      </p>
    </section>

    <!-- ═══ ЭКСПОРТ ═══ -->
    <BottomSheet
      :open="!!exporting"
      title="Экспорт недели"
      subtitle="Готовый блок для weekly_2026.md — отправьте его ассистенту контура"
      @close="exporting = null"
    >
      <pre
        class="kh-scroll overflow-x-auto rounded-[14px] border px-4 py-3.5 font-mono text-[0.75rem] leading-relaxed"
        :style="{ background: 'var(--surface-2)', borderColor: 'var(--line)', color: 'var(--text)' }"
      >{{ exportText }}</pre>

      <button
        type="button"
        class="mt-4 min-h-[52px] w-full rounded-[14px] font-brand text-[1rem] font-semibold active:opacity-90"
        :style="{ background: 'var(--action)', color: 'var(--action-ink)' }"
        @click="copyExport"
      >{{ copied ? 'Скопировано' : 'Скопировать' }}</button>

      <p class="mt-3 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
        После того как блок внесён в мастер и прогнан <code>tools/build_app_data.py</code>,
        неделя перестанет числиться «только в телефоне».
      </p>
    </BottomSheet>
    </template>
  </div>
</template>
