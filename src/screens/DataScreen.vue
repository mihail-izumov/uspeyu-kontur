<script setup>
import { computed, reactive, ref } from 'vue'
import StatusChip from '../components/StatusChip.vue'
import BottomSheet from '../components/BottomSheet.vue'
import { humanAge, fmtDate, ageDays } from '../composables/useData.js'

/* «Данные» — служебный раздел. Аналог Health Checklist в Apple Health:
 * витрина того, чего у контура нет, вместо того, что у него есть.
 *
 * ⚠ ПОЧЕМУ ЭТОТ РАЗДЕЛ РАВНОПРАВЕН С ОСТАЛЬНЫМИ, А НЕ СПРЯТАН В НАСТРОЙКИ.
 * Канон Р-3: «новые поля данных важнее новых расчётов». Один неизмеренный
 * B12 даёт больше, чем любая изощрённая обработка имеющихся тринадцати
 * заборов. Пока в списке есть 🔴, приоритет там, — и раздел должен быть
 * на виду, иначе правило существует только на бумаге.
 *
 * ⚠⚠ «ПРОБЕЛ НА ФОНЕ ТЕРАПИИ» — ОТДЕЛЬНАЯ КАТЕГОРИЯ, А НЕ ОБЫЧНЫЙ ПРОБЕЛ.
 * Препарат принимается, а положенный контроль не сдавался после начала
 * приёма. Пятнадцать лет ИПП без единой проверки B12 — не забывчивость:
 * это следствие того, что никто не смотрел на препарат и на анализы
 * одновременно. Раздел существует, чтобы этот взгляд был.
 */
const props = defineProps({
  data: { type: Object, required: true },
})

const tab = ref('gaps') // gaps | meds | conditions | tasks

/* Все маркёры контура — по одному разу, даже если входят в две системы. */
const markers = computed(() => {
  const seen = new Map()
  for (const s of props.data.systems) {
    for (const m of s.markers) {
      if (!seen.has(m.key)) seen.set(m.key, { ...m, system: s.short })
    }
  }
  return [...seen.values()]
})

const gaps = computed(() =>
  markers.value
    .filter((m) => m.status === 'gap')
    .sort((a, b) => (a.priority === '🔴' ? -1 : 1) - (b.priority === '🔴' ? -1 : 1)),
)
const stale = computed(() =>
  markers.value.filter((m) => m.status === 'stale').sort((a, b) => b.age_days - a.age_days),
)
const thin = computed(() => markers.value.filter((m) => m.status === 'thin'))
const blocked = computed(() => markers.value.filter((m) => m.status === 'blocked'))
const full = computed(() => markers.value.filter((m) => m.status === 'full'))

/* Пробелы на фоне терапии: препарат принимается, контроль не сдавался
 * ПОСЛЕ начала приёма. Дата начала берётся из §4 стандарта полноты. */
const therapyGaps = computed(() => {
  const byKey = Object.fromEntries(markers.value.map((m) => [m.key, m]))
  return (props.data.therapy_gaps || []).map((g) => {
    const since = parseSince(g.since)
    const missing = g.watch
      .map((k) => byKey[k])
      .filter((m) => {
        if (!m) return false
        if (m.status === 'blocked') return false
        if (!m.last_date) return true
        return since ? new Date(m.last_date) < since : false
      })
    return { ...g, missing }
  }).filter((g) => g.missing.length)
})

function parseSince(s) {
  const m = /(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(s || '')
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1))) : null
}

const orphanConditions = computed(() => (props.data.conditions || []).filter((c) => c.orphan))

/* ═══ SYS-8 (Д-32): «К визиту» ═══
 * Сопоставление «врач ↔ вопросы/тревоги/показатели» сделано генератором
 * (build_visits в build_app_data.py) — здесь только отрисовка по кодам.
 * Правка содержимого визита = правка мастера, не этого файла. */
const visit = ref(null) // открытая страница врача

const visits = computed(() => props.data.visits || [])
const questionsByCode = computed(() =>
  Object.fromEntries((props.data.questions || []).map((q) => [q.code, q])),
)
const alertsByCode2 = computed(() =>
  Object.fromEntries((props.data.alerts || []).map((a) => [a.code, a])),
)
/* Список принимаемого — целиком, из мастера. Правило vizit-k-vrachu:
 * врач слышит полный список, а не «по памяти». */
const allMeds = computed(() => props.data.meds || [])
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s }
/* ═══ SYS-15 (Д-33): раздел «Задачи» ═══
 *
 * Устройство перенесено из приложения boom-cmd (раздел «Проекты»), по слову
 * владельца «один в один»: сворачиваемые группы с круглым счётчиком в
 * заголовке, все свёрнуты по умолчанию (ревизия эталона 12.06.2026 — экран
 * открывается компактной сводкой), спокойная монохромная карточка, детали в
 * read-only модалке.
 *
 * ⚠ ОДНО ОТЛИЧИЕ, И ОНО ОСОЗНАННОЕ. В эталоне группы — это статусы, а на
 * карточке стоит значок приоритета. Здесь наоборот: группы — приоритет
 * (владелец просил 🔴/🟠/🟡/бэклог), а на карточке — статус и срок. Ось,
 * по которой сгруппировано, на карточке не повторяется: повторённая, она
 * занимает место и ничего не добавляет.
 *
 * ⛔ ЭКРАН ЧИТАЕТ, НЕ ПИШЕТ. Отметить выполнение отсюда нельзя (Д-12):
 * «Готово» ставится в мастере, когда результат внесён, — и подтверждает это
 * владелец, а не касание в телефоне.
 *
 * ⚠ Данные готовит генератор: ряд, приоритет, связки, дата срока и признак
 * просрочки приезжают полями (Д-29). Разбор markdown в компоненте был бы
 * вторым парсером той же разметки — однажды они разойдутся.
 */
const openTasks = computed(() => (props.data.tasks || []).filter((t) => !t.done))

const TASK_ROW_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'DOC', label: 'Визиты' },
  { id: 'LAB', label: 'Анализы' },
  { id: 'MED', label: 'Препараты' },
  { id: 'DATA', label: 'Архив' },
  { id: 'SYS', label: 'Контур' },
]
const TASK_PRIORITIES = [
  { rank: 1, mark: '🔴', label: 'Горит' },
  { rank: 2, mark: '🟠', label: 'Высокий' },
  { rank: 3, mark: '🟡', label: 'Средний' },
  { rank: 4, mark: '⚪', label: 'Бэклог' },
]
const taskRow = ref('all')
const taskOpen = reactive({ 1: false, 2: false, 3: false, 4: false })
const taskDetail = ref(null)

const visibleTasks = computed(() =>
  taskRow.value === 'all'
    ? openTasks.value
    : openTasks.value.filter((t) => t.row === taskRow.value),
)
/* Только непустые группы. Пустая группа «Горит» с нулём читалась бы как
 * «сегодня ничего не горит» — а она означала бы всего лишь фильтр. */
const taskGroups = computed(() =>
  TASK_PRIORITIES
    .map((p) => ({ ...p, items: visibleTasks.value.filter((t) => t.priority === p.rank) }))
    .filter((g) => g.items.length),
)
const overdueCount = computed(() => visibleTasks.value.filter((t) => t.overdue).length)

function taskWord(n) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'задача'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'задачи'
  return 'задач'
}

const lastDrawAge = computed(() => ageDays(props.data.last_draw))

const TABS = [
  { id: 'gaps', label: 'Пробелы' },
  { id: 'meds', label: 'Препараты' },
  { id: 'conditions', label: 'Диагнозы' },
  { id: 'tasks', label: 'Задачи' },
]

const medDetail = ref(null)
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- ═══ ШАПКА СОСТОЯНИЯ ═══ -->
    <section
      class="rounded-[20px] border px-5 py-4"
      :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', boxShadow: 'var(--card-shadow)' }"
    >
      <div class="flex items-baseline justify-between gap-3">
        <div>
          <p class="font-brand text-[1.0625rem] font-semibold">Свежесть картины</p>
          <p class="mt-0.5 text-[0.8125rem]" :style="{ color: 'var(--text-muted)' }">
            Последний забор {{ fmtDate(data.last_draw) }}
          </p>
        </div>
        <StatusChip
          :level="lastDrawAge > 540 ? 'alarm' : (lastDrawAge > 365 ? 'watch' : 'ok')"
          :label="`${humanAge(lastDrawAge)} назад`"
          size="sm"
        />
      </div>
      <div class="mt-3.5 grid grid-cols-4 gap-2 text-center">
        <div v-for="g in [
          { n: full.length, label: 'полных', level: 'ok' },
          { n: stale.length, label: 'устарело', level: 'watch' },
          { n: thin.length, label: 'тонких', level: 'watch' },
          { n: gaps.length, label: 'пробелов', level: 'alarm' },
        ]" :key="g.label" class="rounded-[12px] py-2.5" :style="{ background: `var(--sig-${g.level}-fill)` }">
          <p class="font-mono text-[1.25rem] font-semibold tabular-nums" :style="{ color: `var(--sig-${g.level}-ink)` }">{{ g.n }}</p>
          <p class="text-[0.6875rem]" :style="{ color: `var(--sig-${g.level}-ink)` }">{{ g.label }}</p>
        </div>
      </div>
    </section>

    <!-- ═══ К ВИЗИТУ (SYS-8) ═══ -->
    <section v-if="visits.length">
      <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
        К визиту
      </h2>
      <div class="flex flex-col gap-1.5">
        <button
          v-for="v in visits"
          :key="v.doctor"
          type="button"
          class="flex w-full items-center gap-3 rounded-[14px] border px-4 py-3 text-left active:opacity-80"
          :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
          @click="visit = v"
        >
          <div class="min-w-0 flex-1">
            <p class="text-[0.9375rem] font-medium">{{ cap(v.doctor) }}</p>
            <p class="mt-0.5 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
              <template v-if="v.questions.length">вопросов: {{ v.questions.length }}</template>
              <template v-if="v.questions.length && v.alerts.length"> · </template>
              <template v-if="v.alerts.length">тревог: {{ v.alerts.length }}</template>
              <template v-if="v.attention.length"> · показать: {{ v.attention.length }}</template>
            </p>
          </div>
          <span aria-hidden="true" :style="{ color: 'var(--text-muted)' }">›</span>
        </button>
      </div>
    </section>

    <!-- ═══ СТРАНИЦА ВИЗИТА ═══ -->
    <BottomSheet
      :open="!!visit"
      :title="visit ? cap(visit.doctor) : ''"
      subtitle="Страница на один приём: показать врачу как есть"
      @close="visit = null"
    >
      <template v-if="visit">
        <template v-if="visit.questions.length">
          <h3 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
            Спросить
          </h3>
          <ol class="flex flex-col gap-2">
            <li
              v-for="(code, i) in visit.questions"
              :key="code"
              class="rounded-[14px] border px-4 py-3"
              :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
            >
              <div class="flex items-center gap-2 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
                <span class="font-mono">{{ i + 1 }}. {{ code }}</span>
              </div>
              <p class="mt-1 text-[0.9375rem] leading-snug">
                {{ questionsByCode[code]?.question || questionsByCode[code]?.title }}
              </p>
            </li>
          </ol>
        </template>

        <template v-if="visit.alerts.length">
          <h3 class="mb-2 mt-6 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
            Тревоги контура — адресованы этому врачу
          </h3>
          <div class="flex flex-col gap-2">
            <article
              v-for="code in visit.alerts"
              :key="code"
              class="rounded-[14px] border px-4 py-3"
              :style="{ background: 'var(--sig-alarm-fill)', borderColor: 'var(--sig-alarm)' }"
            >
              <span class="font-mono text-[0.75rem]" :style="{ color: 'var(--sig-alarm-ink)' }">{{ code }}</span>
              <p class="mt-1 text-[0.875rem] font-medium leading-snug" :style="{ color: 'var(--sig-alarm-ink)' }">
                {{ alertsByCode2[code]?.title }}
              </p>
            </article>
          </div>
        </template>

        <template v-if="visit.attention.length">
          <h3 class="mb-2 mt-6 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
            Показать: что вне цели или не измерялось
          </h3>
          <ul class="flex flex-col gap-1.5">
            <li
              v-for="a in visit.attention"
              :key="a.key"
              class="flex items-baseline justify-between gap-3 rounded-[12px] border px-4 py-2.5"
              :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
            >
              <span class="min-w-0 flex-1 truncate text-[0.875rem]">{{ a.name }}</span>
              <span class="shrink-0 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
                <template v-if="a.last_value !== null">{{ a.last_value }} {{ a.unit }} · </template>{{ a.why }}
              </span>
            </li>
          </ul>
        </template>

        <h3 class="mb-2 mt-6 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
          Принимаю сейчас — список целиком
        </h3>
        <p class="mb-2 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
          Полный список, не по памяти: врач, слышащий часть схемы, решает по неверным вводным.
        </p>
        <ul class="flex flex-col gap-1">
          <li
            v-for="m in allMeds"
            :key="m.name"
            class="rounded-[12px] border px-4 py-2.5 text-[0.875rem]"
            :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
          >
            {{ m.name }}
            <span class="text-[0.75rem]" :style="{ color: 'var(--text-muted)' }"> · {{ m.group }}<template v-if="m.regimen"> · {{ m.regimen }}</template></span>
          </li>
        </ul>

        <p class="mt-6 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
          ⛔ Это подготовка к разговору, а не заключение. Решения — в кабинете.
        </p>
      </template>
    </BottomSheet>

    <!-- ═══ ВКЛАДКИ ═══ -->
    <div class="flex gap-1 rounded-full p-1" :style="{ background: 'var(--surface-2)' }">
      <button
        v-for="t in TABS"
        :key="t.id"
        type="button"
        class="min-h-[40px] flex-1 rounded-full text-[0.8125rem] active:opacity-70"
        :style="tab === t.id
          ? { background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--card-shadow)' }
          : { color: 'var(--text-muted)' }"
        @click="tab = t.id"
      >{{ t.label }}</button>
    </div>

    <!-- ═══ ПРОБЕЛЫ ═══ -->
    <template v-if="tab === 'gaps'">
      <!-- ⚠⚠ Худший вид пробела идёт первым. -->
      <section v-if="therapyGaps.length">
        <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--sig-alarm)' }">
          Пробелы на фоне терапии
        </h2>
        <p class="kh-balance mb-2.5 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-secondary)' }">
          Препарат принимается, а положенный при нём контроль не сдавался после начала приёма.
        </p>
        <div class="flex flex-col gap-2">
          <article
            v-for="g in therapyGaps"
            :key="g.med"
            class="rounded-[16px] border px-4 py-3.5"
            :style="{ background: 'var(--sig-alarm-fill)', borderColor: 'var(--sig-alarm)' }"
          >
            <div class="flex items-baseline justify-between gap-3">
              <p class="font-medium" :style="{ color: 'var(--sig-alarm-ink)' }">{{ g.med }}</p>
              <span class="shrink-0 font-mono text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">с {{ g.since }}</span>
            </div>
            <ul class="mt-2 flex flex-wrap gap-1.5">
              <li
                v-for="m in g.missing"
                :key="m.key"
                class="rounded-full px-2.5 py-1 text-[0.75rem]"
                :style="{ background: 'var(--surface)', color: 'var(--sig-alarm-ink)' }"
              >{{ m.name }}</li>
            </ul>
          </article>
        </div>
      </section>

      <section v-if="blocked.length">
        <h2 class="mb-2 mt-2 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--sig-blocked)' }">
          Сейчас измерять нельзя
        </h2>
        <div class="flex flex-col gap-2">
          <article
            v-for="m in blocked"
            :key="m.key"
            class="rounded-[16px] border px-4 py-3.5"
            :style="{ background: 'var(--sig-blocked-fill)', borderColor: 'var(--sig-blocked)' }"
          >
            <p class="font-medium" :style="{ color: 'var(--sig-blocked-ink)' }">{{ m.name }}</p>
            <p class="mt-1 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-secondary)' }">
              {{ m.why_interval }}
            </p>
            <p class="mt-1.5 text-[0.8125rem] leading-snug" :style="{ color: 'var(--sig-blocked-ink)' }">
              Ложноотрицательный результат хуже несданного: несданный оставляет вопрос
              открытым, ложноотрицательный закрывает его неверно.
            </p>
          </article>
        </div>
      </section>

      <section v-if="gaps.length">
        <h2 class="mb-2 mt-2 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
          Ни одной точки за всё время
        </h2>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="m in gaps"
            :key="m.key"
            class="flex items-center gap-3 rounded-[14px] border px-4 py-3"
            :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-[0.9375rem]">{{ m.name }}</p>
              <p class="mt-0.5 text-[0.75rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
                {{ m.system }}<template v-if="m.why_interval"> · {{ m.why_interval }}</template>
              </p>
            </div>
            <StatusChip level="unknown" :label="m.priority === '🔴' ? 'ключевой' : 'пробел'" size="sm" />
          </li>
        </ul>
      </section>

      <section v-if="stale.length">
        <h2 class="mb-2 mt-2 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
          Пора пересдать
        </h2>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="m in stale"
            :key="m.key"
            class="flex items-center gap-3 rounded-[14px] border px-4 py-3"
            :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-[0.9375rem]">{{ m.name }}</p>
              <p class="mt-0.5 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
                {{ humanAge(m.age_days) }} назад · интервал {{ m.interval_m }} мес
              </p>
            </div>
            <StatusChip level="watch" label="устарело" size="sm" />
          </li>
        </ul>
      </section>
    </template>

    <!-- ═══ ПРЕПАРАТЫ ═══ -->
    <template v-else-if="tab === 'meds'">
      <p class="kh-balance text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
        ⛔ Контур не назначает и не отменяет. Этот список — память, а не рецепт.
      </p>
      <div class="flex flex-col gap-2">
        <button
          v-for="m in data.meds"
          :key="m.name"
          type="button"
          class="rounded-[16px] border px-4 py-3.5 text-left active:opacity-80"
          :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
          @click="medDetail = m"
        >
          <div class="flex items-baseline justify-between gap-3">
            <p class="font-medium leading-snug">{{ m.name }}</p>
            <span class="shrink-0 text-[0.6875rem] uppercase tracking-[0.08em]" :style="{ color: 'var(--text-muted)' }">
              {{ m.group === 'постоянно' ? 'постоянно' : 'курсом' }}
            </span>
          </div>
          <p v-if="m.regimen" class="mt-1 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-secondary)' }">
            {{ m.regimen }}<template v-if="m.since"> · с {{ m.since }}</template>
          </p>
          <p v-if="m.warn" class="mt-2 text-[0.8125rem] leading-snug" :style="{ color: 'var(--sig-alarm)' }">
            {{ m.warn }}
          </p>
        </button>
      </div>
    </template>

    <!-- ═══ ДИАГНОЗЫ ═══ -->
    <template v-else-if="tab === 'conditions'">
      <p class="kh-balance text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
        Только диагнозы из документов с подписью врача. Контур диагнозов не ставит.
      </p>
      <section v-if="orphanConditions.length">
        <h2 class="mb-2 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--sig-alarm)' }">
          Никем не ведётся
        </h2>
        <div class="flex flex-col gap-2">
          <article
            v-for="c in orphanConditions"
            :key="c.name"
            class="rounded-[16px] border px-4 py-3.5"
            :style="{ background: 'var(--sig-alarm-fill)', borderColor: 'var(--sig-alarm)' }"
          >
            <p class="font-medium leading-snug" :style="{ color: 'var(--sig-alarm-ink)' }">{{ c.name }}</p>
            <p class="mt-1 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-secondary)' }">{{ c.led_by }}</p>
          </article>
        </div>
      </section>
      <section>
        <h2 class="mb-2 mt-2 font-label text-[0.75rem] uppercase tracking-[0.14em]" :style="{ color: 'var(--text-muted)' }">
          Активные диагнозы
        </h2>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="c in data.conditions"
            :key="c.name"
            class="rounded-[14px] border px-4 py-3"
            :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
          >
            <p class="text-[0.9375rem] leading-snug">
              <span v-if="c.flag" :style="{ color: 'var(--sig-alarm)' }">{{ c.flag }} </span>{{ c.name }}
            </p>
            <p v-if="c.led_by" class="mt-0.5 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
              ведётся: {{ c.led_by }}
            </p>
          </li>
        </ul>
      </section>
    </template>

    <!-- ═══ ЗАДАЧИ ═══ -->
    <template v-else>
      <!-- фильтр по рядам; «Визиты» стоит первым после «Все»:
           у визитов есть срок, который закрывается сам собой -->
      <div class="kh-scroll -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-0.5">
        <button
          v-for="f in TASK_ROW_FILTERS"
          :key="f.id"
          type="button"
          class="min-h-[36px] shrink-0 rounded-full border px-3.5 text-[0.8125rem] active:opacity-70"
          :style="taskRow === f.id
            ? { background: 'var(--action)', color: 'var(--action-ink)', borderColor: 'var(--action)' }
            : { background: 'var(--surface)', borderColor: 'var(--rim)', color: 'var(--text-secondary)' }"
          @click="taskRow = f.id"
        >{{ f.label }}</button>
      </div>

      <p class="px-1 text-[0.8125rem]" :style="{ color: 'var(--text-muted)' }">
        Открыто {{ visibleTasks.length }} {{ taskWord(visibleTasks.length) }}<template v-if="overdueCount">, срок вышел у {{ overdueCount }}</template>
      </p>

      <div class="flex flex-col gap-3">
        <section v-for="g in taskGroups" :key="g.rank" class="flex flex-col gap-2">
          <button
            type="button"
            class="flex min-h-[44px] items-center gap-2 rounded-[12px] px-1 text-left active:opacity-70"
            :aria-expanded="taskOpen[g.rank]"
            @click="taskOpen[g.rank] = !taskOpen[g.rank]"
          >
            <svg
              viewBox="0 0 16 16"
              class="h-4 w-4 shrink-0 transition-transform duration-150"
              :class="taskOpen[g.rank] ? 'rotate-90' : ''"
              fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"
              :style="{ color: 'var(--text-muted)' }"
              aria-hidden="true"
            ><path d="M6 3l5 5-5 5" /></svg>
            <span class="text-[1rem] font-semibold">{{ g.mark }} {{ g.label }}</span>
            <span
              class="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-[0.8125rem] font-medium leading-none"
              :style="{ background: 'var(--line)', color: 'var(--text-secondary)' }"
            >{{ g.items.length }}</span>
          </button>

          <div v-show="taskOpen[g.rank]" class="flex flex-col gap-2">
            <button
              v-for="t in g.items"
              :key="t.code"
              type="button"
              class="flex w-full flex-col gap-2 rounded-[16px] border px-4 py-3.5 text-left active:opacity-70"
              :style="{ background: 'var(--surface)', borderColor: t.overdue ? 'var(--sig-alarm)' : 'var(--rim)' }"
              @click="taskDetail = t"
            >
              <div class="flex flex-wrap items-center gap-1.5">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-[0.75rem] font-medium leading-tight"
                  :style="{ background: 'var(--line)', color: 'var(--text-secondary)' }"
                >{{ t.row_label }}</span>
                <span class="font-mono text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">{{ t.code }}</span>
              </div>

              <span class="text-[0.9375rem] font-medium leading-snug">{{ t.what }}</span>

              <div class="flex flex-wrap items-center gap-2">
                <span class="text-[0.6875rem] uppercase tracking-[0.08em]" :style="{ color: 'var(--text-muted)' }">{{ t.status }}</span>
                <span
                  v-if="t.due"
                  class="text-[0.75rem]"
                  :style="{ color: t.overdue ? 'var(--sig-alarm)' : 'var(--text-muted)' }"
                >{{ t.due }}</span>
                <span
                  v-for="l in t.links"
                  :key="l"
                  class="inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[0.6875rem] leading-tight"
                  :style="{ borderColor: 'var(--rim)', color: 'var(--text-muted)' }"
                >{{ l }}</span>
              </div>
            </button>
          </div>
        </section>
      </div>

      <p v-if="!visibleTasks.length" class="px-1 text-[0.875rem]" :style="{ color: 'var(--text-muted)' }">
        В этом ряду открытых задач нет.
      </p>

      <p class="kh-balance px-1 pb-2 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
        ⛔ Приложение не закрывает задачи. «Готово» ставится в контуре, когда результат
        внесён в мастер, — не когда сходил.
      </p>
    </template>

    <!-- ═══ КАРТОЧКА ЗАДАЧИ (read-only, как в эталоне) ═══ -->
    <BottomSheet
      :open="!!taskDetail"
      :title="taskDetail?.code || ''"
      :subtitle="taskDetail ? `${taskDetail.row_label} · ${taskDetail.priority_label}` : ''"
      @close="taskDetail = null"
    >
      <template v-if="taskDetail">
        <p class="text-[1rem] font-medium leading-snug">{{ taskDetail.what }}</p>
        <dl class="mt-4 flex flex-col gap-3">
          <div>
            <dt class="font-label text-[0.75rem] uppercase tracking-[0.12em]" :style="{ color: 'var(--text-muted)' }">Статус</dt>
            <dd class="mt-0.5 text-[0.9375rem]">{{ taskDetail.status }}</dd>
          </div>
          <div v-if="taskDetail.due">
            <dt class="font-label text-[0.75rem] uppercase tracking-[0.12em]" :style="{ color: 'var(--text-muted)' }">Срок</dt>
            <dd class="mt-0.5 text-[0.9375rem]" :style="{ color: taskDetail.overdue ? 'var(--sig-alarm)' : 'var(--text)' }">
              {{ taskDetail.due }}<template v-if="taskDetail.overdue"> · срок вышел</template>
            </dd>
          </div>
          <div v-if="taskDetail.why">
            <!-- ⛔ «Зачем» — обязательное поле реестра: задача, для которой
                 нельзя назвать закрываемый пробел или риск, в реестр не
                 попадает (Д-12). Поэтому оно здесь, а не спрятано. -->
            <dt class="font-label text-[0.75rem] uppercase tracking-[0.12em]" :style="{ color: 'var(--text-muted)' }">Зачем</dt>
            <dd class="mt-0.5 text-[0.9375rem] leading-snug">{{ taskDetail.why }}</dd>
          </div>
          <div v-if="taskDetail.linked">
            <dt class="font-label text-[0.75rem] uppercase tracking-[0.12em]" :style="{ color: 'var(--text-muted)' }">Связано</dt>
            <dd class="mt-0.5 text-[0.9375rem] leading-snug">{{ taskDetail.linked }}</dd>
          </div>
        </dl>
        <p class="mt-4 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
          ⛔ Отсюда задачу нельзя закрыть, перенести или изменить: реестр —
          workspace/ЗАДАЧИ.md, и статус в нём меняется по подтверждению владельца.
        </p>
      </template>
    </BottomSheet>

    <!-- ═══ КАРТОЧКА ПРЕПАРАТА ═══ -->
    <BottomSheet
      :open="!!medDetail"
      :title="medDetail?.name || ''"
      :subtitle="medDetail?.note || ''"
      @close="medDetail = null"
    >
      <template v-if="medDetail">
        <dl class="flex flex-col gap-3">
          <div v-if="medDetail.regimen">
            <dt class="font-label text-[0.75rem] uppercase tracking-[0.12em]" :style="{ color: 'var(--text-muted)' }">Режим</dt>
            <dd class="mt-0.5 text-[0.9375rem] leading-snug">{{ medDetail.regimen }}</dd>
          </div>
          <div v-if="medDetail.since">
            <dt class="font-label text-[0.75rem] uppercase tracking-[0.12em]" :style="{ color: 'var(--text-muted)' }">Принимается с</dt>
            <dd class="mt-0.5 text-[0.9375rem] leading-snug">{{ medDetail.since }}</dd>
          </div>
          <div v-if="medDetail.why">
            <dt class="font-label text-[0.75rem] uppercase tracking-[0.12em]" :style="{ color: 'var(--text-muted)' }">Зачем</dt>
            <dd class="mt-0.5 text-[0.9375rem] leading-snug">{{ medDetail.why }}</dd>
          </div>
          <div v-if="medDetail.prescriber">
            <dt class="font-label text-[0.75rem] uppercase tracking-[0.12em]" :style="{ color: 'var(--text-muted)' }">Кто назначил</dt>
            <dd class="mt-0.5 text-[0.9375rem] leading-snug">{{ medDetail.prescriber }}</dd>
          </div>
        </dl>
        <p
          v-if="medDetail.warn"
          class="mt-4 rounded-[14px] px-4 py-3 text-[0.875rem] leading-relaxed"
          :style="{ background: 'var(--sig-alarm-fill)', color: 'var(--sig-alarm-ink)' }"
        >{{ medDetail.warn }}</p>
        <p class="mt-4 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
          ⛔ Ничего из написанного не является указанием начать, отменить или изменить приём.
          Подробная справка по препарату — в контуре, в meds/spravki/.
        </p>
      </template>
    </BottomSheet>
  </div>
</template>
