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
import PublicScreen from './screens/PublicScreen.vue'
import { useGate } from './composables/useGate.js'
import { useData, usePublicData } from './composables/useData.js'
import { useWeekly } from './composables/useWeekly.js'
import { useIntake } from './composables/useIntake.js'
import { computeCharge, chargeSeries } from './composables/chargeModel.js'

const gate = useGate()
const { data, error: dataError, load } = useData()

/* Д-45: ДВА СЛОЯ ОДНОГО ПРИЛОЖЕНИЯ.
 *
 * До входа — публичная страница «Успею»: вилка Горизонта, календарь недель,
 * «Как читать», манифест. После входа — медкарта.
 *
 * ⚠ Раньше это были ДВА приложения с двумя входами и двумя шифрованными
 *   файлами. Владелец увидел последствие на живом сайте 30.08.2026: «у меня
 *   два закрытых слоя, а нужен один». Слито сюда, потому что закрытый слой
 *   тут уже был, а витрина добавляла второй на ровном месте.
 *
 * ⛔ Публичные данные грузятся СРАЗУ и не ждут пароля; медкарта — только
 *   после входа. Порядок именно такой, а не наоборот. */
const { publicData, loadPublic } = usePublicData()
const showGate = ref(false)

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
onMounted(loadPublic)

/* ⚠ Тёмная тема системной шапки на входе и светлая внутри. Атрибут висит на
 * <html>, потому что цвет строки состояния берётся с фона документа, а не
 * с компонента. */
/* ⚠ Тёмная тема — ТОЛЬКО на экране ввода пароля. Публичная страница светлая,
 * как и приложение: она витрина продукта, а не заслон. Раньше условием было
 * «не вошёл» — с появлением публичной страницы это красило бы её в чёрное. */
watch([() => gate.authed.value, showGate], ([authed, gateOpen]) => {
  const dark = !authed && gateOpen
  document.documentElement.setAttribute('data-theme', dark ? 'auth-dark' : '')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0A0A0A' : '#F7F6F3')
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
  <!-- ═══ ПУБЛИЧНЫЙ СЛОЙ — без пароля (Д-41/Д-45) ═══ -->
  <div v-if="!gate.authed.value && !showGate">
    <div class="up-topbar">
      <span class="up-brand">Успею</span>
      <button type="button" class="up-enter" @click="showGate = true">Войти</button>
    </div>
    <PublicScreen v-if="publicData && publicData.horizon" :pub="publicData" />
    <div v-else class="up-wrap up-state">
      <h1>Успею</h1>
      <p>Первый прогон готовится.</p>
      <p class="up-muted up-small">
        Данные готовит контур командой <code>python3 tools/build_app_data.py</code>.
      </p>
    </div>
  </div>

  <!-- ⚠ Кнопка выхода из гейта обязательна: без неё человек, нажавший
       «Войти» из любопытства, заперт на экране пароля до перезагрузки.
       Стоит НАД гейтом отдельным слоем, чтобы не трогать его вёрстку. -->
  <button
    v-else-if="!gate.authed.value"
    type="button"
    class="up-back"
    @click="showGate = false"
  >← Назад</button>
  <AccessGate
    v-if="!gate.authed.value && showGate"
    :login="gate.login"
    :checking="gate.checking.value"
    :error="gate.error.value"
    :notice="gate.notice.value"
    :unsupported="gate.unsupported.value"
    @submit="gate.submit"
  />

  <!-- ⚠ v-if, а НЕ v-else. Кнопка «Назад» между гейтом и оболочкой разорвала
       цепочку v-if/v-else-if/v-else, и `v-else` стал относиться к AccessGate:
       на публичной странице отрисовывалась оболочка медкарты с вкладками
       «Заряд · День · Системы · Прогресс · Данные». Данных в ней не было, но
       структура приложения была видна до входа. Поймано дымом 30.08.2026
       (стоп-слово «Заряд» на странице до входа), глазами не заметно —
       вкладки уезжали ниже первого экрана. -->
  <AppShell
    v-if="gate.authed.value"
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
        :life="data.life || {}"
        :onboarding="data.onboarding || { sections: [] }"
        :reviewed="(publicData && publicData.weeks && publicData.weeks.reviewed) || []"
        :streak="(publicData && publicData.weeks && publicData.weeks.streak) || 0"
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
