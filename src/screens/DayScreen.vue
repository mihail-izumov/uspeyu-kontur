<script setup>
import { computed, ref, watch } from 'vue'
import BottomSheet from '../components/BottomSheet.vue'
import { CARRIERS, exportDay, fmtDay, isEmpty } from '../composables/useIntake.js'

/* «День» — химический слой: что принимается по схеме и что от неё отклонилось.
 *
 * ⚠ ЭТО НЕ ДНЕВНИК ПРИЁМА. Плановый день разворачивается из мастера
 * препаратов генератором и приезжает сюда готовым; человек отмечает только
 * отклонение. Экран, который каждый вечер спрашивает «что вы сегодня приняли»,
 * заполняется две недели, а потом не заполняется никогда.
 *
 * ⛔ ЭКРАН НЕ СОВЕТУЕТ. Ни «сократить», ни «пора начать», ни «это многовато».
 * Он показывает счётчики и ряды; связь «носитель → симптом» рождается в
 * недельном разборе при трёх совпадениях, а решение о схеме — у врача
 * (docs/STANDARD-safety.md). Проверяется дымом: app/scripts/smoke.mjs.
 *
 * ⚠⚠ НОЛЬ В ОКНЕ, КОТОРОЕ СТАРШЕ СЛОЯ, — НЕ ФАКТ. Слой заведён 26.08.2026, а
 * экспозиция считается за 30 и 90 дней. «0 дней из 30» на второй неделе жизни
 * слоя означает «не записывалось», а не «не принималось», и подпись об этом
 * стоит рядом с числом, а не в примечании внизу. Канон Р-6: «не измерялось»
 * ≠ «в норме».
 */
const props = defineProps({
  chemistry: { type: Object, required: true },
  entries: { type: Object, default: () => ({}) },
  editableDays: { type: Array, default: () => [] },
  pendingExport: { type: Array, default: () => [] },
})
const emit = defineEmits(['save'])

const SLOT_ORDER = ['morning', 'day', 'evening']
const SLOT_LABEL = { morning: 'Утро', day: 'День', evening: 'Вечер' }

const daily = computed(() => (props.chemistry.plan || []).filter((p) => p.cadence === 'ежедневно'))
const courses = computed(() => (props.chemistry.plan || []).filter((p) => p.cadence !== 'ежедневно'))

/* Таймлайн: только те времена суток, что названы в режиме мастера.
 * ⚠ Препарат без указанного времени попадает в «без времени», а не
 *   раскладывается по утрам наугад: придуманное время выглядит на экране
 *   ровно так же, как записанное. */
const timeline = computed(() => {
  const rows = SLOT_ORDER.map((id) => ({
    id,
    label: SLOT_LABEL[id],
    items: daily.value.filter((p) => p.slots.some((s) => s.id === id)),
  })).filter((r) => r.items.length)
  const noTime = daily.value.filter((p) => !p.slots.length)
  if (noTime.length) rows.push({ id: 'any', label: 'Без указания времени', items: noTime })
  return rows
})

const since = computed(() => props.chemistry.since)
const exposure = computed(() => props.chemistry.exposure || [])
const carriersByWeek = computed(() => [...(props.chemistry.carriers || [])].reverse().slice(0, 6))
const lastWeek = computed(() => carriersByWeek.value[0] || null)

/* ── отметка ─────────────────────────────────────────────────────────── */
const markOpen = ref(false)
const markDay = ref(props.editableDays[0] || '')
const draft = ref(blank())

function blank() {
  return { carriers: [], carrierNotes: {}, skips: [], extra: '', note: '' }
}

function openMark() {
  markDay.value = props.editableDays[0] || ''
  loadDraft()
  markOpen.value = true
}

function loadDraft() {
  const saved = props.entries[markDay.value]
  draft.value = saved ? JSON.parse(JSON.stringify(saved)) : blank()
  if (!draft.value.carrierNotes) draft.value.carrierNotes = {}
}
watch(markDay, loadDraft)

function toggleCarrier(id) {
  const has = draft.value.carriers.includes(id)
  draft.value.carriers = has
    ? draft.value.carriers.filter((c) => c !== id)
    : [...draft.value.carriers, id]
}

function toggleSkip(item, slot) {
  const i = draft.value.skips.findIndex((s) => s.key === item.key && s.slot === slot)
  if (i === -1) draft.value.skips.push({ key: item.key, name: item.name, slot })
  else draft.value.skips.splice(i, 1)
}
function skipped(item, slot) {
  return draft.value.skips.some((s) => s.key === item.key && s.slot === slot)
}

function saveMark() {
  emit('save', markDay.value, JSON.parse(JSON.stringify(draft.value)))
  markOpen.value = false
}

/* ── экспорт ─────────────────────────────────────────────────────────── */
const exporting = ref(null)
const copied = ref(false)

function openExport(row) {
  exporting.value = row
  copied.value = false
}
const exportText = computed(() =>
  exporting.value ? exportDay(exporting.value.day, exporting.value.entry, props.chemistry.plan || []) : '',
)
async function copyExport() {
  try {
    await navigator.clipboard.writeText(exportText.value)
    copied.value = true
  } catch {
    // Clipboard API требует защищённого контекста и жеста: текст на экране,
    // его можно выделить руками.
    copied.value = false
  }
}

const draftEmpty = computed(() => isEmpty(draft.value))
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- ═══ НЕ ПЕРЕНЕСЕНО В МАСТЕР ═══
         Первым и намеренно, как в «Прогрессе»: отметка, оставшаяся в
         телефоне, для контура не существует. -->
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
        Пока отметка живёт только в телефоне, она не попадает ни в экспозицию,
        ни в разбор недели и пропадёт при чистке браузера.
      </p>
      <div class="mt-3 flex flex-col gap-2">
        <button
          v-for="row in pendingExport"
          :key="row.day"
          type="button"
          class="flex min-h-[48px] items-center justify-between gap-3 rounded-[12px] border px-4 text-left active:opacity-70"
          :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
          @click="openExport(row)"
        >
          <span class="font-mono text-[0.875rem]">{{ row.day }}</span>
          <span class="text-[0.8125rem]" :style="{ color: 'var(--action-text)' }">Экспорт</span>
        </button>
      </div>
    </section>

    <!-- ═══ ПЛАНОВЫЙ ДЕНЬ ═══ -->
    <section
      class="rounded-[20px] border px-5 py-5"
      :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', boxShadow: 'var(--card-shadow)' }"
    >
      <h2 class="font-brand text-[1.0625rem] font-semibold">Обычный день</h2>
      <p class="kh-balance mt-1 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
        Развёрнут из мастера препаратов. Отмечать нужно не его, а отклонения от него.
      </p>

      <div v-if="timeline.length" class="mt-4 flex flex-col gap-4">
        <div v-for="row in timeline" :key="row.id" class="flex gap-3">
          <div class="flex flex-col items-center pt-1.5">
            <span class="block h-2 w-2 shrink-0 rounded-full" :style="{ background: 'var(--sig-ok)' }"></span>
            <span class="mt-1 w-px flex-1" :style="{ background: 'var(--line)' }"></span>
          </div>
          <div class="min-w-0 flex-1 pb-1">
            <p class="kh-caps text-[0.6875rem] uppercase" :style="{ color: 'var(--text-muted)' }">{{ row.label }}</p>
            <ul class="mt-1.5 flex flex-col gap-1.5">
              <li v-for="p in row.items" :key="p.name + row.id" class="text-[0.9375rem] leading-snug">
                {{ p.name }}
                <span v-if="p.dose" class="text-[0.8125rem]" :style="{ color: 'var(--text-muted)' }"> · {{ p.dose }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <p v-else class="mt-3 text-[0.875rem]" :style="{ color: 'var(--text-muted)' }">
        В мастере препаратов нет позиций постоянной схемы.
      </p>

      <p v-if="courses.length" class="kh-balance mt-3 border-t pt-3 text-[0.8125rem] leading-relaxed"
         :style="{ borderColor: 'var(--line)', color: 'var(--text-secondary)' }">
        Курсом, не каждый день:
        <span v-for="(p, i) in courses" :key="p.name">{{ i ? ', ' : '' }}{{ p.name }}</span>.
        Такт курса задаётся мастером, поэтому в таймлайне дня их нет.
      </p>

      <button
        type="button"
        class="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-[14px] px-4 text-[0.9375rem] font-medium active:opacity-70"
        :style="{ background: 'var(--action)', color: 'var(--action-ink)' }"
        @click="openMark"
      >
        Отметить событие
      </button>
    </section>

    <!-- ═══ ЭКСПОЗИЦИЯ ═══ -->
    <section
      class="rounded-[20px] border px-5 py-5"
      :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', boxShadow: 'var(--card-shadow)' }"
    >
      <h2 class="font-brand text-[1.0625rem] font-semibold">Экспозиция</h2>
      <p class="kh-balance mt-1 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
        Сколько дней записан приём — за последние 30 и 90 дней.
      </p>

      <ul v-if="exposure.length" class="mt-4 flex flex-col gap-3">
        <li v-for="e in exposure" :key="e.key">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-[0.9375rem]">{{ e.key }}</span>
            <span class="font-mono text-[0.875rem]">{{ e.days30 }} из 30 · {{ e.days90 }} из 90</span>
          </div>
          <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" :style="{ background: 'var(--line)' }">
            <div
              class="h-full rounded-full"
              :style="{ width: `${Math.min(100, (e.days30 / 30) * 100)}%`, background: 'var(--sig-watch)' }"
            ></div>
          </div>
          <p v-if="e.what" class="mt-1 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">{{ e.what }}</p>
        </li>
      </ul>
      <p v-else class="mt-3 text-[0.875rem]" :style="{ color: 'var(--text-muted)' }">
        Внеплановых приёмов в слое пока не записано.
      </p>

      <p class="kh-balance mt-4 border-t pt-3 text-[0.8125rem] leading-relaxed"
         :style="{ borderColor: 'var(--line)', color: 'var(--text-secondary)' }">
        ⚠ Слой ведётся с {{ since || '—' }}. Всё, что было раньше этой даты, записывать
        было некуда, поэтому окна 30 и 90 дней пока неполные: маленькое число здесь
        означает «мало записано», а не «мало принято».
      </p>
    </section>

    <!-- ═══ НОСИТЕЛИ ═══ -->
    <section
      class="rounded-[20px] border px-5 py-5"
      :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', boxShadow: 'var(--card-shadow)' }"
    >
      <h2 class="font-brand text-[1.0625rem] font-semibold">Носители по неделям</h2>
      <p class="kh-balance mt-1 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
        Дней с нагрузкой за неделю. Считаются дни, а не порции: порции живут в недельной отметке.
      </p>

      <table v-if="carriersByWeek.length" class="mt-4 w-full text-[0.875rem]">
        <thead>
          <tr class="kh-caps text-[0.625rem] uppercase" :style="{ color: 'var(--text-muted)' }">
            <th class="pb-2 text-left font-normal">неделя</th>
            <th v-for="c in CARRIERS" :key="c.id" class="pb-2 text-right font-normal">{{ c.label.split(' ')[0] }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in carriersByWeek" :key="w.week" class="border-t" :style="{ borderColor: 'var(--line)' }">
            <td class="py-2 font-mono text-[0.8125rem]">{{ w.week }}</td>
            <td v-for="c in CARRIERS" :key="c.id" class="py-2 text-right font-mono">
              <span :style="{ color: w[c.id] ? 'var(--text)' : 'var(--text-muted)' }">{{ w[c.id] }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="mt-3 text-[0.875rem]" :style="{ color: 'var(--text-muted)' }">
        Носителей в слое пока не записано.
      </p>

      <p v-if="lastWeek" class="kh-balance mt-4 border-t pt-3 text-[0.8125rem] leading-relaxed"
         :style="{ borderColor: 'var(--line)', color: 'var(--text-secondary)' }">
        Последняя записанная неделя {{ lastWeek.week }}: дней с нагрузкой — {{ lastWeek.total }}.
        Что из этого с чем связано, решает недельный разбор и только при трёх совпадениях;
        одно совпадение — заметка, а не связь.
      </p>
    </section>

    <!-- ═══ ГРАНИЦА КОНТУРА ═══ -->
    <p class="kh-balance px-1 pb-2 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
      Контур не назначает и не отменяет препараты и не оценивает схему. Здесь только то,
      что записано: план из мастера, отклонения от него и счётчики. Решение о схеме —
      разговор с врачом.
    </p>

    <!-- ═══ ШТОРКА ОТМЕТКИ ═══ -->
    <BottomSheet
      :open="markOpen"
      title="Отметить событие"
      subtitle="Только отклонения. День, в котором всё шло по схеме, отмечать не нужно."
      @close="markOpen = false"
    >
      <div class="flex flex-col gap-5 pb-2">
        <!-- дата -->
        <div>
          <p class="kh-caps text-[0.6875rem] uppercase" :style="{ color: 'var(--text-muted)' }">Когда</p>
          <div class="mt-2 flex gap-2">
            <button
              v-for="(d, i) in editableDays"
              :key="d"
              type="button"
              class="min-h-[44px] flex-1 rounded-[12px] border px-3 text-[0.875rem] active:opacity-70"
              :style="markDay === d
                ? { background: 'var(--action)', color: 'var(--action-ink)', borderColor: 'var(--action)' }
                : { background: 'var(--surface)', borderColor: 'var(--rim)' }"
              @click="markDay = d"
            >
              {{ i === 0 ? 'Сегодня' : 'Вчера' }} · {{ fmtDay(d) }}
            </button>
          </div>
          <p class="kh-balance mt-2 text-[0.75rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
            Дальше вчерашнего форма не пускает: память подгоняет прошедшее под то,
            что случилось потом. Более старое вносится в мастер руками, с источником.
          </p>
        </div>

        <!-- носители -->
        <div>
          <p class="kh-caps text-[0.6875rem] uppercase" :style="{ color: 'var(--text-muted)' }">Носители</p>
          <div class="mt-2 flex flex-col gap-2">
            <div v-for="c in CARRIERS" :key="c.id">
              <button
                type="button"
                class="flex min-h-[48px] w-full items-center gap-3 rounded-[12px] border px-4 text-left active:opacity-70"
                :style="draft.carriers.includes(c.id)
                  ? { background: 'var(--sig-watch-fill)', borderColor: 'var(--sig-watch)' }
                  : { background: 'var(--surface)', borderColor: 'var(--rim)' }"
                :aria-pressed="draft.carriers.includes(c.id)"
                @click="toggleCarrier(c.id)"
              >
                <span
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border"
                  :style="{ borderColor: draft.carriers.includes(c.id) ? 'var(--sig-watch)' : 'var(--rim)' }"
                >
                  <svg v-if="draft.carriers.includes(c.id)" viewBox="0 0 16 16" class="h-3.5 w-3.5" fill="none" aria-hidden="true">
                    <path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-[0.9375rem] leading-snug">{{ c.label }}</span>
                  <span class="block text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">{{ c.hint }}</span>
                </span>
              </button>
              <input
                v-if="draft.carriers.includes(c.id)"
                v-model="draft.carrierNotes[c.id]"
                type="text"
                class="mt-1.5 min-h-[44px] w-full rounded-[12px] border px-4 text-[0.875rem]"
                :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', color: 'var(--text)' }"
                placeholder="что именно и когда — вино, ужин"
              />
            </div>
          </div>
        </div>

        <!-- пропуски планового -->
        <div v-if="daily.length">
          <p class="kh-caps text-[0.6875rem] uppercase" :style="{ color: 'var(--text-muted)' }">Пропущено из схемы</p>
          <div class="mt-2 flex flex-col gap-2">
            <template v-for="p in daily" :key="p.name">
              <button
                v-for="s in (p.slots.length ? p.slots : [{ id: 'any', label: '' }])"
                :key="p.name + s.id"
                type="button"
                class="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-[12px] border px-4 text-left active:opacity-70"
                :style="skipped(p, s.label)
                  ? { background: 'var(--sig-alarm-fill)', borderColor: 'var(--sig-alarm)' }
                  : { background: 'var(--surface)', borderColor: 'var(--rim)' }"
                :aria-pressed="skipped(p, s.label)"
                @click="toggleSkip(p, s.label)"
              >
                <span class="min-w-0 flex-1 text-[0.9375rem] leading-snug">{{ p.name }}</span>
                <span v-if="s.label" class="shrink-0 text-[0.8125rem]" :style="{ color: 'var(--text-muted)' }">{{ s.label }}</span>
              </button>
            </template>
          </div>
        </div>

        <!-- внеплановое -->
        <div>
          <p class="kh-caps text-[0.6875rem] uppercase" :style="{ color: 'var(--text-muted)' }">Принято сверх схемы</p>
          <textarea
            v-model="draft.extra"
            rows="2"
            class="mt-2 w-full rounded-[12px] border px-4 py-3 text-[0.9375rem]"
            :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', color: 'var(--text)' }"
            placeholder="аркоксия 120 мг — приступ, левая пятка"
          ></textarea>
          <p class="mt-1 text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
            Каждое с новой строки. Название и доза — как на упаковке.
          </p>
        </div>

        <!-- заметка -->
        <div>
          <p class="kh-caps text-[0.6875rem] uppercase" :style="{ color: 'var(--text-muted)' }">Заметка</p>
          <textarea
            v-model="draft.note"
            rows="2"
            class="mt-2 w-full rounded-[12px] border px-4 py-3 text-[0.9375rem]"
            :style="{ background: 'var(--surface)', borderColor: 'var(--rim)', color: 'var(--text)' }"
            placeholder="утро только вода, кофе не было — забор натощак"
          ></textarea>
        </div>

        <button
          type="button"
          class="min-h-[52px] w-full rounded-[14px] text-[0.9375rem] font-medium active:opacity-70 disabled:opacity-40"
          :style="{ background: 'var(--action)', color: 'var(--action-ink)' }"
          :disabled="draftEmpty"
          @click="saveMark"
        >
          Сохранить отметку
        </button>
        <p v-if="draftEmpty" class="kh-balance -mt-3 text-[0.75rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
          Пустая отметка не сохраняется: «ничего не отклонилось» — это отсутствие записи,
          и слой читает его именно так.
        </p>
      </div>
    </BottomSheet>

    <!-- ═══ ШТОРКА ЭКСПОРТА ═══ -->
    <BottomSheet
      :open="!!exporting"
      title="Блок для мастера"
      :subtitle="exporting ? `Отметка за ${exporting.day}` : ''"
      @close="exporting = null"
    >
      <pre
        class="kh-scroll overflow-x-auto rounded-[12px] border px-4 py-3 font-mono text-[0.8125rem] leading-relaxed"
        :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
      >{{ exportText }}</pre>
      <button
        type="button"
        class="mt-3 min-h-[52px] w-full rounded-[14px] text-[0.9375rem] font-medium active:opacity-70"
        :style="{ background: 'var(--action)', color: 'var(--action-ink)' }"
        @click="copyExport"
      >
        {{ copied ? 'Скопировано' : 'Скопировать' }}
      </button>
    </BottomSheet>
  </div>
</template>
