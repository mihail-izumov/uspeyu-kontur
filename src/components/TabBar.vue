<script setup>
/* Таб-бар — плавающая капсула по стандарту iOS: скруглённая плашка с воздухом
 * по периметру, а не полоса во всю ширину экрана. Так она читается контролом
 * поверх содержимого, а не краем окна. Перенесено из «Где рост?».
 *
 * ⚠ Цвета берутся из набора `--nav-*`, объявленного только в `:root`, и от
 *   холста страницы не зависят. Капсула принадлежит приложению, а не разделу:
 *   она стоит на всех экранах и отвечает на вопрос «где я и куда могу
 *   перейти». Перекрашиваясь вместе со страницей, она сообщала бы, что
 *   изменился сам орган управления, тогда как изменилась только страница.
 *
 * ⚠ Пустой `active` — законное состояние, а не ошибка. Человек стоит на
 *   под-странице (карточка системы, опрос), и она не принадлежит ни одной
 *   вкладке: подсвеченные «Системы» над экраном опроса сообщали бы, что
 *   человек находится там, где его нет.
 *
 * Стекло — Tailwind-утилита backdrop-blur, а не своё свойство: autoprefixer
 * добавляет -webkit-backdrop-filter, без которого на iOS Safari размытие не
 * рисуется вовсе.
 */
defineProps({
  tabs: { type: Array, required: true },
  active: { type: String, default: '' },
})
defineEmits(['select'])
</script>

<template>
  <nav
    role="tablist"
    class="flex items-stretch gap-1 rounded-full border p-1 shadow-lg backdrop-blur"
    :style="{
      borderColor: 'var(--nav-line)',
      background: 'color-mix(in srgb, var(--nav-surface) 88%, transparent)',
    }"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="active === tab.id"
      class="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-full px-2 outline-none transition-colors duration-150"
      :style="active === tab.id ? { background: 'var(--nav-accent)' } : {}"
      @click="$emit('select', tab.id)"
    >
      <svg
        viewBox="0 0 24 24"
        class="h-[20px] w-[20px]"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        :style="{ color: active === tab.id ? 'var(--nav-accent-ink)' : 'var(--nav-muted)' }"
      >
        <!-- «Заряд»: батарея с молнией. Метафора заряда/расхода — то же, что
             у Body Battery, и знак обязан её повторять, иначе шкала 0–100
             читается как оценка, а не как запас. -->
        <template v-if="tab.icon === 'charge'">
          <rect x="2.5" y="7" width="15" height="10" rx="2.5" />
          <path d="M20.5 10.5v3" />
          <path d="M10.6 9.4 8.2 12.6h3.2l-1.4 2.4" />
        </template>
        <!-- «Системы»: сердце в контуре — органы-мишени. -->
        <template v-else-if="tab.icon === 'systems'">
          <path d="M12 20s-6.5-4.2-6.5-9A3.6 3.6 0 0 1 12 8.6a3.6 3.6 0 0 1 6.5 2.4c0 4.8-6.5 9-6.5 9z" />
          <path d="M3 13.4h3l1.2-2 1.6 3.4 1.3-2.2" />
        </template>
        <!-- «Прогресс»: ряд недель. Столбики, а не линия: неделя — дискретна,
             и линия обещала бы, что между отметками что-то измерялось. -->
        <template v-else-if="tab.icon === 'progress'">
          <path d="M4 20V13" />
          <path d="M9 20V8.5" />
          <path d="M14 20v-5" />
          <path d="M19 20V4.5" />
        </template>
        <!-- «Данные»: слои архива с пробелом. -->
        <template v-else>
          <path d="M4 7c0-1.4 3.6-2.5 8-2.5S20 5.6 20 7s-3.6 2.5-8 2.5S4 8.4 4 7z" />
          <path d="M4 12c0 1.4 3.6 2.5 8 2.5 1.4 0 2.7-.1 3.8-.3" />
          <path d="M4 7v10c0 1.4 3.6 2.5 8 2.5" />
          <path d="M20 7v4" />
          <path d="M18.5 15.5v2.2M18.5 20.2v.1" />
        </template>
      </svg>
      <span
        class="kh-caps text-[0.625rem] uppercase"
        style="--caps-track: 0.06em"
        :style="{ color: active === tab.id ? 'var(--nav-accent-ink)' : 'var(--nav-muted)' }"
      >{{ tab.label }}</span>
    </button>
  </nav>
</template>
