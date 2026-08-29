<script setup>
import { computed, reactive, ref, watch } from 'vue'
import BottomSheet from './BottomSheet.vue'
import { SURVEY, MINIMUM_KEYS, fmtWeekRange } from '../composables/useWeekly.js'

/* Воскресная отметка. Шесть шагов вместо одной длинной портянки.
 *
 * ⚠ ПОЧЕМУ ШАГАМИ. Анкета из тридцати полей на одном экране заполняется один
 *   раз, а недельный слой ценен только рядом. Шаг с четырьмя вопросами
 *   виден целиком без прокрутки, и его можно закрыть, не потеряв
 *   предыдущие: черновик сохраняется на каждом шаге.
 *
 * ⛔ НИ ОДНО ПОЛЕ НЕ ОБЯЗАТЕЛЬНО, И ЭТО НЕ НЕБРЕЖНОСТЬ. Правило мастера:
 *   пропущенное поле лучше выдуманного. Обязательные поля заставляют
 *   человека что-нибудь поставить, лишь бы пройти дальше, — и ряд наполняется
 *   числами, которых никто не наблюдал. Пропуск и ноль здесь разные вещи и
 *   хранятся по-разному: пропуск не попадает в экспорт вовсе.
 *
 * ⛔ «Ничего не было» — отдельная кнопка на последнем шаге. Молчание и
 *   «ничего» — разные факты.
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  week: { type: String, required: true },
  initial: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['close', 'save'])

const step = ref(0)
const answers = reactive({})

watch(() => props.open, (v) => {
  if (!v) return
  step.value = 0
  for (const k of Object.keys(answers)) delete answers[k]
  Object.assign(answers, props.initial || {})
})

const current = computed(() => SURVEY[step.value])
const isLast = computed(() => step.value === SURVEY.length - 1)

const filledMinimum = computed(() =>
  MINIMUM_KEYS.filter((k) => k === 'who5'
    ? Number.isFinite(answers.who5_1)
    : answers[k] !== undefined && answers[k] !== '').length,
)

function set(key, value) {
  answers[key] = value
}
function toggleChoice(key, value) {
  // Повторный тап по выбранному варианту снимает ответ. Иначе случайно
  // нажатую кнопку уже не отменить, и в ряд уходит чужое значение.
  answers[key] = answers[key] === value ? undefined : value
}
function next() {
  if (isLast.value) return finish()
  step.value += 1
}
function back() {
  if (step.value > 0) step.value -= 1
}
function finish(nothingHappened = false) {
  const out = { ...answers }
  if (nothingHappened) out.events = 'ничего значимого'
  emit('save', out)
}
</script>

<template>
  <BottomSheet
    :open="open"
    :title="current?.title || 'Отметка недели'"
    :subtitle="`${week} · ${fmtWeekRange(week)} · шаг ${step + 1} из ${SURVEY.length}`"
    @close="emit('close')"
  >
    <!-- Полоса шагов. Не «прогресс-бар ради красоты»: она показывает, сколько
         ещё осталось, — единственный способ не бросить анкету на середине. -->
    <div class="mb-4 flex gap-1" aria-hidden="true">
      <span
        v-for="(s, i) in SURVEY"
        :key="s.id"
        class="block h-1 flex-1 rounded-full"
        :style="{ background: i <= step ? 'var(--action)' : 'var(--line)' }"
      ></span>
    </div>

    <p v-if="current?.intro" class="text-[0.9375rem] font-medium">{{ current.intro }}</p>
    <p v-if="current?.note" class="kh-balance mt-1.5 text-[0.8125rem] leading-relaxed" :style="{ color: 'var(--text-muted)' }">
      {{ current.note }}
    </p>

    <div class="mt-4 flex flex-col gap-3">
      <div
        v-for="item in current.items"
        :key="item.key"
        class="rounded-[16px] border px-4 py-3.5"
        :style="{ background: 'var(--surface)', borderColor: 'var(--rim)' }"
      >
        <p class="text-[0.9375rem] leading-snug">{{ item.text }}</p>
        <p v-if="item.hint" class="mt-1 text-[0.75rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
          {{ item.hint }}
        </p>

        <!-- Шкала WHO-5: шесть кнопок в два ряда. Подписи полные, без
             сокращений: «меньше половины времени» и «больше половины
             времени» различаются одним словом, и урезать их нельзя. -->
        <div v-if="current.scale" class="mt-3 grid grid-cols-2 gap-1.5">
          <button
            v-for="opt in current.scale"
            :key="opt.v"
            type="button"
            class="min-h-[44px] rounded-[12px] border px-3 text-left text-[0.8125rem] leading-snug active:opacity-70"
            :style="answers[item.key] === opt.v
              ? { background: 'var(--action)', borderColor: 'var(--action)', color: 'var(--action-ink)' }
              : { background: 'var(--surface-2)', borderColor: 'var(--line)' }"
            @click="toggleChoice(item.key, opt.v)"
          >{{ opt.label }}</button>
        </div>

        <!-- Числовая шкала боли 0–10. Одиннадцать кнопок в ряд помещаются
             на телефоне при 28px, и это ровно тот размер, при котором в них
             попадают пальцем. -->
        <div v-else-if="item.kind === 'nrs'" class="mt-3">
          <div class="flex gap-1">
            <button
              v-for="n in 11"
              :key="n"
              type="button"
              class="flex h-9 flex-1 items-center justify-center rounded-[8px] border font-mono text-[0.8125rem] tabular-nums active:opacity-70"
              :style="answers[item.key] === n - 1
                ? { background: 'var(--action)', borderColor: 'var(--action)', color: 'var(--action-ink)' }
                : { background: 'var(--surface-2)', borderColor: 'var(--line)' }"
              @click="toggleChoice(item.key, n - 1)"
            >{{ n - 1 }}</button>
          </div>
          <div class="mt-1 flex justify-between text-[0.6875rem]" :style="{ color: 'var(--text-muted)' }">
            <span>нет боли</span><span>невыносимая</span>
          </div>
        </div>

        <div v-else-if="item.kind === 'scale5'" class="mt-3 flex gap-1.5">
          <button
            v-for="n in 5"
            :key="n"
            type="button"
            class="min-h-[44px] flex-1 rounded-[10px] border font-mono text-[0.9375rem] tabular-nums active:opacity-70"
            :style="answers[item.key] === n
              ? { background: 'var(--action)', borderColor: 'var(--action)', color: 'var(--action-ink)' }
              : { background: 'var(--surface-2)', borderColor: 'var(--line)' }"
            @click="toggleChoice(item.key, n)"
          >{{ n }}</button>
        </div>

        <div v-else-if="item.kind === 'count7'" class="mt-3 flex gap-1">
          <button
            v-for="n in 8"
            :key="n"
            type="button"
            class="flex h-10 flex-1 items-center justify-center rounded-[8px] border font-mono text-[0.8125rem] tabular-nums active:opacity-70"
            :style="answers[item.key] === n - 1
              ? { background: 'var(--action)', borderColor: 'var(--action)', color: 'var(--action-ink)' }
              : { background: 'var(--surface-2)', borderColor: 'var(--line)' }"
            @click="toggleChoice(item.key, n - 1)"
          >{{ n - 1 }}</button>
        </div>

        <div v-else-if="item.kind === 'choice'" class="mt-3 flex flex-wrap gap-1.5">
          <button
            v-for="opt in item.options"
            :key="String(opt.v)"
            type="button"
            class="min-h-[44px] rounded-[12px] border px-4 text-[0.875rem] active:opacity-70"
            :style="answers[item.key] === opt.v
              ? { background: 'var(--action)', borderColor: 'var(--action)', color: 'var(--action-ink)' }
              : { background: 'var(--surface-2)', borderColor: 'var(--line)' }"
            @click="toggleChoice(item.key, opt.v)"
          >{{ opt.label }}</button>
        </div>

        <textarea
          v-else-if="item.kind === 'textarea'"
          :value="answers[item.key] ?? ''"
          rows="4"
          placeholder="Визиты, анализы, простуда, стресс, поездки…"
          class="mt-3 w-full rounded-[12px] border px-3 py-2.5 text-[0.9375rem] outline-none"
          :style="{ background: 'var(--surface-2)', borderColor: 'var(--line)', color: 'var(--text)' }"
          @input="set(item.key, $event.target.value)"
        ></textarea>

        <input
          v-else
          :value="answers[item.key] ?? ''"
          :type="item.kind === 'text' ? 'text' : 'number'"
          :inputmode="item.kind === 'decimal' ? 'decimal' : (item.kind === 'number' ? 'numeric' : 'text')"
          :step="item.kind === 'decimal' ? '0.1' : '1'"
          :max="item.max"
          min="0"
          class="mt-3 w-full rounded-[12px] border px-3 py-2.5 font-mono text-[1rem] outline-none"
          :style="{ background: 'var(--surface-2)', borderColor: 'var(--line)', color: 'var(--text)' }"
          @input="set(item.key, item.kind === 'text' ? $event.target.value : ($event.target.value === '' ? undefined : Number($event.target.value)))"
        />
      </div>
    </div>

    <!-- Последний шаг: явная кнопка «ничего не было». -->
    <button
      v-if="isLast"
      type="button"
      class="mt-4 w-full rounded-[14px] border px-4 py-3 text-[0.9375rem] active:opacity-70"
      :style="{ background: 'var(--surface-2)', borderColor: 'var(--line)', color: 'var(--text-secondary)' }"
      @click="finish(true)"
    >Ничего значимого не было — записать так</button>

    <div class="sticky bottom-0 -mx-5 mt-5 flex gap-2 px-5 pb-2 pt-3" :style="{ background: 'var(--sheet)' }">
      <button
        v-if="step > 0"
        type="button"
        class="min-h-[52px] rounded-[14px] border px-5 text-[0.9375rem] active:opacity-70"
        :style="{ borderColor: 'var(--line)', color: 'var(--text-secondary)' }"
        @click="back"
      >Назад</button>
      <button
        type="button"
        class="min-h-[52px] flex-1 rounded-[14px] px-5 font-brand text-[1rem] font-semibold active:opacity-90"
        :style="{ background: 'var(--action)', color: 'var(--action-ink)' }"
        @click="next"
      >{{ isLast ? 'Сохранить отметку' : 'Дальше' }}</button>
    </div>

    <p class="mt-2 text-center text-[0.75rem]" :style="{ color: 'var(--text-muted)' }">
      Заполнено из минимального набора: {{ filledMinimum }} из {{ MINIMUM_KEYS.length }}.
      Ни одно поле не обязательно — пропуск лучше выдуманного значения.
    </p>
  </BottomSheet>
</template>
