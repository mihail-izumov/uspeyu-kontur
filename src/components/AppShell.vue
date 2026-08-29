<script setup>
import TabBar from './TabBar.vue'

/* Оболочка: шапка, холст, плавающая капсула навигации.
 *
 * ⚠ Нижний отступ холста считается, а не подбирается: под капсулой лежит
 *   безопасная зона устройства (полоса жеста на iPhone), и содержимое,
 *   упирающееся в неё, читается обрезанным. 6.5rem = высота капсулы плюс
 *   воздух, дальше — env(safe-area-inset-bottom).
 *
 * ⚠ Подложка-градиент под капсулой красится `--bg`, а не `--nav-surface`:
 *   она часть холста, а не органа управления. Иначе внизу страницы висела бы
 *   дымка чужого цвета.
 */
defineProps({
  tabs: { type: Array, required: true },
  active: { type: String, default: '' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  back: { type: Boolean, default: false },
})
defineEmits(['select', 'back'])
</script>

<template>
  <div class="mx-auto flex min-h-[100svh] w-full max-w-[34rem] flex-col" :style="{ background: 'var(--bg)' }">
    <header
      class="sticky top-0 z-30 flex items-center gap-2 px-5 pt-[calc(env(safe-area-inset-top)+0.875rem)] pb-3 backdrop-blur"
      :style="{ background: 'color-mix(in srgb, var(--bg) 86%, transparent)' }"
    >
      <button
        v-if="back"
        type="button"
        class="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:opacity-60"
        :style="{ color: 'var(--action-text)' }"
        aria-label="Назад"
        @click="$emit('back')"
      >
        <svg viewBox="0 0 20 20" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 4 6 10l6 6" />
        </svg>
      </button>
      <div class="min-w-0 flex-1">
        <h1 class="truncate font-brand text-[1.375rem] font-semibold leading-tight">{{ title }}</h1>
        <p v-if="subtitle" class="mt-0.5 truncate text-[0.8125rem]" :style="{ color: 'var(--text-muted)' }">{{ subtitle }}</p>
      </div>
      <slot name="header-trailing" />
    </header>

    <main class="flex-1 px-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      <slot />
    </main>

    <div class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div
        class="h-16 w-full max-w-[34rem]"
        :style="{ background: 'linear-gradient(to top, var(--bg) 42%, transparent)' }"
        aria-hidden="true"
      ></div>
    </div>
    <div class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div class="pointer-events-auto w-full max-w-[30rem]">
        <TabBar :tabs="tabs" :active="active" @select="$emit('select', $event)" />
      </div>
    </div>
  </div>
</template>
