<script setup>
import { onBeforeUnmount, watch } from 'vue'

/* Шторка снизу — стандартный способ показать подробность, не теряя место,
 * из которого её открыли.
 *
 * ⚠ Позиционируется по ВИДИМОЙ области (класс .kh-sheet-overlay), а не по
 *   окну. Причина — клавиатура на iOS: `fixed` привязан к layout viewport,
 *   клавиатура страницу не двигает, зато Safari сам подтягивает её вверх — и
 *   нижний край панели уходит под клавиатуру целиком. Переменные ставит
 *   useKeyboardInset.js из visualViewport.
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
})
const emit = defineEmits(['close'])

// Прокрутка страницы под открытой шторкой — классическая беда мобильных
// модалок: палец тянет фон вместо содержимого панели.
watch(() => props.open, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
})
onBeforeUnmount(() => { document.body.style.overflow = '' })

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="kh-sheet-overlay z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @keydown="onKey"
    >
      <div
        class="absolute inset-0"
        :style="{ background: 'var(--scrim)' }"
        @click="emit('close')"
      ></div>

      <div
        class="kh-fade-in relative flex max-h-[90%] w-full max-w-[34rem] flex-col rounded-t-[20px] border-t"
        :style="{
          background: 'var(--sheet)',
          borderColor: 'var(--rim)',
          boxShadow: 'inset 0 1px 0 var(--rim-glow), 0 -24px 48px -24px rgba(0,0,0,0.35)',
        }"
      >
        <!-- Ручка: не декор. Она сообщает, что панель можно закрыть, до того
             как человек начнёт искать крестик. -->
        <div class="flex justify-center pt-2.5 pb-1">
          <span class="block h-1 w-9 rounded-full" :style="{ background: 'var(--line)' }"></span>
        </div>

        <div class="flex items-start gap-3 px-5 pb-3 pt-1">
          <div class="min-w-0 flex-1">
            <h2 v-if="title" class="font-brand text-[1.125rem] font-semibold leading-tight">{{ title }}</h2>
            <p v-if="subtitle" class="mt-1 text-[0.8125rem] leading-snug" :style="{ color: 'var(--text-muted)' }">
              {{ subtitle }}
            </p>
          </div>
          <button
            type="button"
            class="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:opacity-60"
            :style="{ color: 'var(--text-muted)' }"
            aria-label="Закрыть"
            @click="emit('close')"
          >
            <svg viewBox="0 0 20 20" class="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div class="kh-scroll flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
