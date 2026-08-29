<script setup>
import { computed, ref } from 'vue'
import StatusChip from '../components/StatusChip.vue'
import BottomSheet from '../components/BottomSheet.vue'
import { systemLight } from '../composables/chargeModel.js'
import { humanAge, fmtDate } from '../composables/useData.js'

/* Шесть систем — навигация первого уровня.
 *
 * ⚠ ПОЧЕМУ НЕ «БИОХИМИЯ / ОАК / МОЧА», КАК В БЛАНКЕ ЛАБОРАТОРИИ.
 * Разбивка по пробиркам отвечает на вопрос лаборанта («что в какую
 * пробирку»), а не на вопрос владельца («что у меня под ударом»). Bioniq
 * и Apple Health оба строят первый уровень по системам тела, и по той же
 * причине: человек ищет «почки», а не «биохимический анализ крови».
 *
 * ⛔ ЧИСЛА ЗДЕСЬ ПО УМОЛЧАНИЮ НЕ ПОКАЗЫВАЮТСЯ. Владелец 29.08.2026: «мне не
 * нужны всякие детали и сравнения цифр». Показатель показан статусом и
 * направлением; само значение открывается тапом по строке — оно никуда не
 * делось, но перестало быть первым, что видно. Разница в том, на какой
 * вопрос экран отвечает по умолчанию: «4,50 против 1,8» или «ЛПНП вне цели
 * и уходит дальше — к кардиологу».
 */
const props = defineProps({
  data: { type: Object, required: true },
})

const detail = ref(null)   // открытая система
const shownValues = ref({}) // ключи маркёров, у которых человек попросил число

const systems = computed(() =>
  props.data.systems.map((s) => {
    const light = systemLight(s)
    const gaps = s.markers.filter((m) => m.status === 'gap' && ['🔴', '🟠'].includes(m.priority))
    const off = s.markers.filter((m) => m.off_target === true)
    const away = s.markers.filter((m) => m.direction === 'away')
    return { ...s, light, gaps, off, away }
  }),
)

const alertsByCode = computed(() =>
  Object.fromEntries((props.data.alerts || []).map((a) => [a.code, a])),
)

/* Вопросы врачу, относящиеся к системе. Связь — по специальности: журнал
 * вопросов не размечен органами, и выдумывать разметку в приложении нельзя
 * (это была бы правка мастера в потребителе). Совпадение по слову из поля
 * «к кому» — грубо, но честно: показывается то, что действительно написано. */
function questionsFor(system) {
  const who = (system.doctor || '').toLowerCase().split(/[\s/(]+/)[0]
  if (!who || who.length < 5) return []
  return (props.data.questions || []).filter(
    (q) => q.open && q.who.toLowerCase().includes(who.slice(0, 6)),
  )
}

/* Порядок маркёров внутри карточки: сначала то, что требует внимания.
 * Ровный алфавитный порядок прятал бы главное между второстепенным. */
const RANK = { alarm: 0, watch: 1, unknown: 2, blocked: 3, ok: 4 }
function markerLevel(m) {
  if (m.status === 'blocked') return 'blocked'
  if (m.status === 'gap') return 'unknown'
  if (m.off_target === true) return 'alarm'
  if (m.status === 'stale' || m.status === 'thin') return 'watch'
  if (m.off_target === false) return 'ok'
  return 'watch'
}
function markerLabel(m) {
  if (m.status === 'blocked') return 'сейчас нельзя'
  if (m.status === 'gap') return 'не измерялось'
  if (m.off_target === true) return 'вне цели'
  if (m.status === 'stale') return 'устарело'
  if (m.status === 'thin') return 'мало точек'
  if (m.status === 'once') return 'измерено однажды'
  return 'в цели'
}
function sortedMarkers(s) {
  return [...s.markers].sort((a, b) => RANK[markerLevel(a)] - RANK[markerLevel(b)])
}

function toggleValue(key) {
  shownValues.value = { ...shownValues.value, [key]: !shownValues.value[key] }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="kh-balance mb-1 text-[0.875rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
      Светофор — не диагноз и не прогноз. Это карта того, где контур смотрит и чего не видит.
    </p>

    <button
      v-for="s in systems"
      :key="s.code"
      type="button"
      class="rounded-[20px] border px-5 py-4 text-left active:opacity-90"
      :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', boxShadow: 'var(--card-shadow)' }"
      @click="detail = s"
    >
      <div class="flex items-start gap-3">
        <!-- Знак системы: полоса цвета светофора слева. Дублирует чип, но
             читается периферийным зрением при прокрутке списка. -->
        <span
          class="mt-1 block h-10 w-1.5 shrink-0 rounded-full"
          :style="{ background: `var(--sig-${s.light})` }"
          aria-hidden="true"
        ></span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-brand text-[1.0625rem] font-semibold">{{ s.name }}</h2>
            <StatusChip :level="s.light" size="sm" />
          </div>
          <p class="kh-balance mt-1.5 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-secondary)' }">
            {{ s.threat }}
          </p>
          <div class="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
            <span v-if="s.off.length">вне цели: {{ s.off.length }}</span>
            <span v-if="s.gaps.length">не измерялось: {{ s.gaps.length }}</span>
            <span v-if="s.away.length">уходят от цели: {{ s.away.length }}</span>
            <span v-if="s.alerts.length">тревог: {{ s.alerts.length }}</span>
          </div>
        </div>
      </div>
    </button>

    <!-- ═══ КАРТОЧКА СИСТЕМЫ ═══ -->
    <BottomSheet
      :open="!!detail"
      :title="detail?.name || ''"
      :subtitle="detail ? `Скорость: ${detail.speed} · к кому: ${detail.doctor}` : ''"
      @close="detail = null; shownValues = {}"
    >
      <template v-if="detail">
        <p class="kh-balance text-[0.9375rem] leading-relaxed">{{ detail.threat }}</p>

        <!-- Тревоги системы — дословно из risk/JOURNAL-risks.md -->
        <template v-if="detail.alerts.length">
          <h3 class="mb-2 mt-6 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
            Тревоги
          </h3>
          <div class="flex flex-col gap-2.5">
            <article
              v-for="code in detail.alerts"
              :key="code"
              class="rounded-[14px] border px-4 py-3.5"
              :style="{ background: 'var(--sig-alarm-fill)', borderColor: 'var(--sig-alarm)' }"
            >
              <div class="flex items-center gap-2">
                <span class="font-mono text-[0.75rem]" :style="{ color: 'var(--sig-alarm-ink)' }">{{ code }}</span>
                <span class="text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">{{ fmtDate(alertsByCode[code]?.date) }}</span>
              </div>
              <p class="mt-1.5 text-[0.9375rem] font-medium leading-snug" :style="{ color: 'var(--sig-alarm-ink)' }">
                {{ alertsByCode[code]?.title }}
              </p>
              <p v-if="alertsByCode[code]?.seen" class="mt-2 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-secondary)' }">
                {{ alertsByCode[code].seen }}
              </p>
              <p v-if="alertsByCode[code]?.doctor" class="mt-2 text-[0.8125rem] font-medium leading-snug" :style="{ color: 'var(--sig-alarm-ink)' }">
                {{ alertsByCode[code].doctor }}
              </p>
            </article>
          </div>
        </template>

        <!-- Показатели: статус и направление. Число — по запросу. -->
        <h3 class="mb-1 mt-6 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
          Показатели
        </h3>
        <p class="mb-2.5 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
          Нажмите на строку, чтобы увидеть число и цель.
        </p>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="m in sortedMarkers(detail)"
            :key="m.key"
            class="rounded-[14px] border"
            :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
          >
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left active:opacity-70"
              @click="toggleValue(m.key)"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-[0.9375rem]">{{ m.name }}</p>
                <p class="mt-0.5 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
                  <template v-if="m.points === 0">за всё время ни одной точки</template>
                  <template v-else>
                    {{ m.points }} {{ m.points === 1 ? 'точка' : (m.points < 5 ? 'точки' : 'точек') }} ·
                    {{ humanAge(m.age_days) }} назад
                  </template>
                </p>
              </div>

              <!-- ⛔ Стрелка рисуется ТОЛЬКО при трёх и более точках. По двум
                   замерам направление не определяется (Д-5), и стрелка там
                   была бы выдумкой, а не сокращением. -->
              <span
                v-if="m.direction"
                class="shrink-0"
                :style="{ color: m.direction === 'away' ? 'var(--sig-alarm)' : 'var(--sig-ok)' }"
                :title="m.direction === 'away' ? 'ряд уходит от цели' : 'ряд идёт к цели'"
              >
                <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path v-if="m.direction === 'away'" d="M3 11l5-5 5 5" />
                  <path v-else d="M3 5l5 5 5-5" />
                </svg>
              </span>

              <StatusChip :level="markerLevel(m)" :label="markerLabel(m)" size="sm" />
            </button>

            <div
              v-if="shownValues[m.key]"
              class="border-t px-4 py-3 text-[0.8125rem] leading-relaxed"
              :style="{ borderColor: 'var(--line)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }"
            >
              <p v-if="m.last_value !== null">
                <span :style="{ color: 'var(--text-muted)' }">последнее:</span>
                <span class="font-mono tabular-nums" :style="{ color: 'var(--text)' }"> {{ m.last_value }} {{ m.unit }}</span>
                <span :style="{ color: 'var(--text-muted)' }"> · {{ fmtDate(m.last_date) }}</span>
              </p>
              <p v-if="m.target">
                <span :style="{ color: 'var(--text-muted)' }">личная цель:</span>
                <span class="font-mono" :style="{ color: 'var(--text)' }"> {{ m.target }}</span>
                <span :style="{ color: 'var(--text-muted)' }"> ({{ m.target_status }})</span>
              </p>
              <p v-if="m.ref">
                <span :style="{ color: 'var(--text-muted)' }">референс лаборатории:</span> {{ m.ref }}
              </p>
              <p v-if="m.slope_per_year !== null" class="mt-1">
                <span :style="{ color: 'var(--text-muted)' }">наклон:</span>
                <span class="font-mono tabular-nums"> {{ m.slope_per_year > 0 ? '+' : '' }}{{ m.slope_per_year }} {{ m.unit }}/год</span>
              </p>
              <p v-if="m.why_interval" class="mt-1.5" :style="{ color: 'var(--text-muted)' }">
                {{ m.why_interval }}
              </p>
              <!-- ⛔ Отдельная оговорка для показателей, которые сейчас нельзя
                   сдавать: ложноотрицательный результат хуже несданного —
                   несданный оставляет вопрос открытым, ложноотрицательный
                   закрывает его неверно. -->
              <p
                v-if="m.status === 'blocked'"
                class="mt-2 rounded-[10px] px-3 py-2 text-[0.8125rem] leading-snug"
                :style="{ background: 'var(--sig-blocked-fill)', color: 'var(--sig-blocked-ink)' }"
              >
                Самовольно не сдавать: на текущей терапии результат будет ложноотрицательным.
                Подготовку назначает врач.
              </p>
            </div>
          </li>
        </ul>

        <!-- Вопросы врачу — выход контура. Не «что делать», а «что спросить». -->
        <template v-if="questionsFor(detail).length">
          <h3 class="mb-2 mt-6 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
            Спросить у врача
          </h3>
          <ul class="flex flex-col gap-2">
            <li
              v-for="q in questionsFor(detail)"
              :key="q.code"
              class="rounded-[14px] border px-4 py-3"
              :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
            >
              <div class="flex items-center gap-2">
                <span class="font-mono text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">{{ q.code }}</span>
                <span class="text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">{{ q.who }}</span>
              </div>
              <p class="mt-1 text-[0.9375rem] leading-snug">{{ q.question || q.title }}</p>
            </li>
          </ul>
        </template>

        <p class="mt-6 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
          ⛔ Контур не назначает и не отменяет препараты. Всё, что здесь написано, —
          подготовка к разговору с врачом, а не замена ему.
        </p>
      </template>
    </BottomSheet>
  </div>
</template>
