<script setup>
import { computed } from 'vue'

/* Чип статуса — единственный способ показать светофор в этом приложении.
 *
 * ⛔ ЦВЕТ ЗДЕСЬ НИКОГДА НЕ ЕДИНСТВЕННЫЙ НОСИТЕЛЬ СМЫСЛА, и компонент устроен
 *    так, что обойти это правило нельзя: у каждого уровня своя ФОРМА знака и
 *    своё СЛОВО, и то и другое рисуется всегда.
 *
 *      ok       ● сплошная точка      «в цели»
 *      watch    ◐ половина            «отклонение»
 *      alarm    ▲ треугольник         «требует внимания»
 *      unknown  ○ пустое кольцо       «не измерялось»
 *      blocked  ⊘ перечёркнутое       «сейчас нельзя»
 *
 *    Причина не в педантизме. При дейтеранопии (~6% мужчин) жёлтый и красный
 *    сближаются; при чёрно-белой печати сводки к визиту врача цвет исчезает
 *    совсем. Форма и слово переживают оба случая.
 *
 * ⚠ Уровень `blocked` — не «плохо» и не «хорошо». Так помечен тест, который
 *   на текущей терапии даёт ложноотрицательный результат (H. pylori на фоне
 *   ИПП). Ложноотрицательный хуже несданного: несданный оставляет вопрос
 *   открытым, ложноотрицательный закрывает его неверно.
 */
const props = defineProps({
  level: { type: String, required: true }, // ok | watch | alarm | unknown | blocked
  label: { type: String, default: '' },
  size: { type: String, default: 'md' },   // sm | md
  tone: { type: String, default: 'fill' }, // fill — плашка · bare — только знак и текст
})

const LEVELS = {
  ok: { word: 'в цели', shape: 'dot' },
  watch: { word: 'отклонение', shape: 'half' },
  alarm: { word: 'внимание', shape: 'tri' },
  unknown: { word: 'не измерялось', shape: 'ring' },
  blocked: { word: 'сейчас нельзя', shape: 'slash' },
}

const meta = computed(() => LEVELS[props.level] || LEVELS.unknown)
const text = computed(() => props.label || meta.value.word)
const v = computed(() => `--sig-${props.level in LEVELS ? props.level : 'unknown'}`)
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-full font-label"
    :class="[
      size === 'sm' ? 'px-2 py-[3px] text-[0.6875rem]' : 'px-2.5 py-1 text-[0.8125rem]',
      tone === 'fill' ? 'border' : '',
    ]"
    :style="tone === 'fill'
      ? { background: `var(${v}-fill)`, color: `var(${v}-ink)`, borderColor: `var(${v})` }
      : { color: `var(${v})` }"
  >
    <!-- Знак рисуется SVG, а не символом шрифта: у эмодзи-подобных глифов
         разная ширина в разных системах, и ряд чипов расползается. -->
    <svg
      class="shrink-0"
      :class="size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'"
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      <template v-if="meta.shape === 'dot'">
        <circle cx="6" cy="6" r="5" :fill="`var(${v})`" />
      </template>
      <template v-else-if="meta.shape === 'half'">
        <circle cx="6" cy="6" r="5" fill="none" :stroke="`var(${v})`" stroke-width="2" />
        <path d="M6 1a5 5 0 0 1 0 10z" :fill="`var(${v})`" />
      </template>
      <template v-else-if="meta.shape === 'tri'">
        <path d="M6 0.8 11.3 10.6H0.7z" :fill="`var(${v})`" />
      </template>
      <template v-else-if="meta.shape === 'ring'">
        <circle cx="6" cy="6" r="4.4" fill="none" :stroke="`var(${v})`" stroke-width="2" />
      </template>
      <template v-else>
        <circle cx="6" cy="6" r="4.6" fill="none" :stroke="`var(${v})`" stroke-width="1.8" />
        <path d="M2.6 9.4 9.4 2.6" :stroke="`var(${v})`" stroke-width="1.8" stroke-linecap="round" />
      </template>
    </svg>
    <span class="kh-caps whitespace-nowrap" style="--caps-track: 0.02em">{{ text }}</span>
  </span>
</template>
