<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AccessGate from './components/AccessGate.vue'
import AppShell from './components/AppShell.vue'
import SurveySheet from './components/SurveySheet.vue'
import ChargeScreen from './screens/ChargeScreen.vue'
import DayScreen from './screens/DayScreen.vue'
import SystemsScreen from './screens/SystemsScreen.vue'
import ProgressScreen from './screens/ProgressScreen.vue'
import DataScreen from './screens/DataScreen.vue'
import { useGate } from './composables/useGate.js'
import { useData } from './composables/useData.js'
import { useWeekly } from './composables/useWeekly.js'
import { useIntake } from './composables/useIntake.js'
import { computeCharge, chargeSeries } from './composables/chargeModel.js'

const gate = useGate()
const { data, error: dataError, load } = useData()

const masterWeeks = computed(() => data.value?.weekly || [])
const weekly = useWeekly(masterWeeks)

/* Химический слой (SYS-10, Д-33). События из мастера приезжают в генерате;
 * отметки, ещё не перенесённые в мастер, живут в телефоне — как у недельного
 * слоя, и по той же причине: мастер остаётся единственным источником истины. */
const masterEvents = computed(() => data.value?.chemistry?.events || [])
const intake = useIntake(masterEvents)

/* ⚠ Пятая вкладка, а не шестая. «День» — единственный экран, куда пишут, и
 *   он стоит вторым, сразу за «Зарядом». «Задачи» отдельной вкладкой не
 *   заводились: они живут разделом внутри «Данных», где уже стоят просрочки,
 *   пробелы и препараты. Шесть вкладок в капсуле перестают читаться —
 *   и первым перестаёт читаться то, что реже открывают. */
const TABS = [
  { id: 'charge', label: 'Заряд', icon: 'charge', title: 'Заряд' },
  { id: 'day', label: 'День', icon: 'day', title: 'День' },
  { id: 'systems', label: 'Системы', icon: 'systems', title: 'Системы' },
  { id: 'progress', label: 'Прогресс', icon: 'progress', title: 'Прогресс' },
  { id: 'data', label: 'Данные', icon: 'data', title: 'Данные' },
]
const active = ref('charge')
const surveyOpen = ref(false)
const surveyWeek = ref(null)

/* Данные грузятся ТОЛЬКО после входа. Это не про безопасность (файл лежит
 * открыто, его видно и без приложения), а про честность интерфейса: экран
 * входа, за которым в сети уже проехали все диагнозы, обещает не то, что
 * делает. Заодно первый экран рисуется быстрее. */
watch(() => gate.authed.value, (v) => { if (v) load() })

/* ⚠ Тёмная тема системной шапки на входе и светлая внутри. Атрибут висит на
 * <html>, потому что цвет строки состояния берётся с фона документа, а не
 * с компонента. */
watch(() => gate.authed.value, (v) => {
  document.documentElement.setAttribute('data-theme', v ? '' : 'auth-dark')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', v ? '#F7F6F3' : '#0A0A0A')
}, { immediate: true })

const charge = computed(() => {
  if (!data.value) return null
  return computeCharge(data.value, weekly.latest.value, new Date())
})

const series = computed(() =>
  data.value ? chargeSeries(data.value, [...weekly.weeks.value].reverse()) : [],
)

const currentWeekFilled = computed(() =>
  weekly.weeks.value.some((w) => w.week === weekly.currentWeek.value),
)

/* Опрос «пора» в воскресенье и в понедельник: воскресенье — день отметки,
 * понедельник — законный хвост для тех, кто в воскресенье не открыл телефон.
 * Дальше баннер остаётся, но перестаёт быть синим: настойчивость, которая
 * длится всю неделю, перестаёт читаться как напоминание. */
const isSurveyDue = computed(() => {
  const d = new Date().getDay()
  return (d === 0 || d === 1) && !currentWeekFilled.value
})

function openSurvey() {
  surveyWeek.value = weekly.editableWeeks.value.find(
    (w) => !weekly.weeks.value.some((x) => x.week === w),
  ) || weekly.currentWeek.value
  surveyOpen.value = true
}

function saveSurvey(fields) {
  weekly.save(surveyWeek.value, fields)
  surveyOpen.value = false
  active.value = 'progress'
}

const shellTitle = computed(() => TABS.find((t) => t.id === active.value)?.title || '')
const shellSubtitle = computed(() => {
  if (!data.value) return ''
  if (active.value === 'charge') return `Метод ${charge.value?.method || ''}`
  if (active.value === 'day') return 'Химический слой · только отклонения от схемы'
  if (active.value === 'systems') return 'Шесть систем · органы-мишени контура'
  if (active.value === 'progress') return `${weekly.weeks.value.length} отметок в ряду`
  return `Данные собраны ${data.value.built}`
})

onMounted(() => {
  // Регистрация service worker — только на защищённом соединении и только в
  // собранном виде. В dev он мешает: кэш переживает правки и приходится
  // гадать, почему изменения не видны.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const base = import.meta.env.BASE_URL || './'
    navigator.serviceWorker.register(`${base}sw.js`).catch(() => {})
  }
})
</script>

<template>
  <AccessGate
    v-if="!gate.authed.value"
    :login="gate.login"
    :checking="gate.checking.value"
    :error="gate.error.value"
    :notice="gate.notice.value"
    :unsupported="gate.unsupported.value"
    @submit="gate.submit"
  />

  <AppShell
    v-else
    :tabs="TABS"
    :active="active"
    :title="shellTitle"
    :subtitle="shellSubtitle"
    @select="active = $event"
  >
    <div v-if="dataError" class="rounded-[20px] border px-5 py-5" :style="{ background: 'var(--sig-alarm-fill)', borderColor: 'var(--sig-alarm)' }">
      <p class="text-[0.9375rem] leading-relaxed" :style="{ color: 'var(--sig-alarm-ink)' }">{{ dataError }}</p>
    </div>

    <div v-else-if="!data" class="flex flex-col gap-3">
      <div class="kh-skeleton h-64 rounded-[20px]"></div>
      <div class="kh-skeleton h-24 rounded-[20px]"></div>
      <div class="kh-skeleton h-24 rounded-[20px]"></div>
    </div>

    <template v-else>
      <ChargeScreen
        v-if="active === 'charge'"
        :data="data"
        :charge="charge"
        :series="series"
        :week-filled="currentWeekFilled"
        :is-survey-due="isSurveyDue"
        @open-survey="openSurvey"
      />
      <DayScreen
        v-else-if="active === 'day'"
        :chemistry="data.chemistry || {}"
        :entries="intake.entries.value"
        :editable-days="intake.editableDays.value"
        :pending-export="intake.pendingExport.value"
        @save="intake.save"
      />
      <SystemsScreen v-else-if="active === 'systems'" :data="data" />
      <ProgressScreen
        v-else-if="active === 'progress'"
        :weeks="weekly.weeks.value"
        :series="series"
        :pending-export="weekly.pendingExport.value"
        :current-week="weekly.currentWeek.value"
        :charge-method="charge?.method || ''"
        @open-survey="openSurvey"
      />
      <DataScreen v-else :data="data" />
    </template>
  </AppShell>

  <SurveySheet
    v-if="surveyWeek"
    :open="surveyOpen"
    :week="surveyWeek"
    :initial="weekly.localAnswers.value[surveyWeek] || {}"
    @close="surveyOpen = false"
    @save="saveSurvey"
  />
</template>
