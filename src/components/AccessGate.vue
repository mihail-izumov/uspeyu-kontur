<script setup>
import { computed, ref } from 'vue'

/* Экран входа. Раскладка перенесена из «Бумбастика»
 * (boom-cmd/src/components/AccessKeyForm.vue): три зоны — знак сверху,
 * карта ввода по центру за счёт равных flex-полей, подпись в подвале.
 *
 * Отличия от исходника, и у каждого есть причина:
 *
 *  1. Вместо брендового лочкапа — собственный знак контура: кольцо с
 *     пунктирным сектором. Кольцо замкнуто не полностью, и это не
 *     украшение: незакрытая дуга — то самое место, где у контура нет
 *     данных. Знак говорит, чем занято приложение, до первого экрана.
 *
 *  2. Появилась строка про открытые данные. Экран входа, который молчит
 *     о том, что он не защита, обещает больше, чем делает. Владелец
 *     29.08.2026 выбрал мягкий гейт осознанно — значит, и написано об
 *     этом должно быть прямо, а не в README, куда никто не пойдёт.
 *
 *  3. Логин не редактируется (readonly, а не disabled: disabled выключает
 *     поле из чтения скринридером и глушит его через opacity, а логин
 *     должен оставаться читаемым — это контекст входа).
 *
 * Цвет = сигнал: единственный цветной элемент экрана — текст ошибки.
 */
const props = defineProps({
  login: { type: String, required: true },
  checking: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  notice: { type: String, default: null },
  unsupported: { type: Boolean, default: false },
})
const emit = defineEmits(['submit'])

const phrase = ref('')
const show = ref(false)

// Крупный кегль включается ТОЛЬКО когда в поле есть что маскировать: иначе
// переключение глаза на пустом поле двигало бы placeholder, хотя пользователь
// ничего не вводил.
const masked = computed(() => !show.value && phrase.value.length > 0)

function onSubmit() {
  const v = phrase.value.trim()
  if (!v || props.checking) return
  emit('submit', v)
}
</script>

<template>
  <div
    data-theme="auth-dark"
    class="flex min-h-[100svh] flex-col px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    :style="{ background: 'var(--bg)' }"
  >
    <!-- знак и имя -->
    <div class="flex flex-1 items-start justify-center pt-[13svh]">
      <div class="flex flex-col items-center" role="img" aria-label="Контур здоровья">
        <svg viewBox="0 0 64 64" class="h-[72px] w-[72px]" fill="none" aria-hidden="true">
          <!-- Замкнутая часть — то, что контур видит. -->
          <path
            d="M32 6a26 26 0 1 1-18.4 44.4"
            :stroke="'var(--text)'"
            stroke-width="3.4"
            stroke-linecap="round"
          />
          <!-- Разрыв — то, чего у контура нет. Пунктир, а не пустота:
               пробел существует и посчитан, он не «ничего». -->
          <path
            d="M13.6 50.4A26 26 0 0 1 6 32"
            :stroke="'var(--text-muted)'"
            stroke-width="3.4"
            stroke-linecap="round"
            stroke-dasharray="1 7"
          />
          <path d="M18 33.5h7.5l3.5-8 5.5 15 3.5-7h8" :stroke="'var(--text)'" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span
          class="mt-4 font-brand text-[2.1875rem] font-semibold uppercase leading-none tracking-[0.06em]"
          style="margin-right: -0.06em"
          :style="{ color: 'var(--text)' }"
          aria-hidden="true"
        >Контур</span>
        <span
          class="mt-2 font-label text-[0.75rem] uppercase tracking-[0.28em]"
          style="margin-right: -0.28em"
          :style="{ color: 'var(--text-muted)' }"
          aria-hidden="true"
        >Здоровье</span>
      </div>
    </div>

    <!-- карта ввода -->
    <form class="mx-auto w-full max-w-[20rem]" @submit.prevent="onSubmit">
      <div
        class="flex flex-col gap-4 rounded-[20px] border p-6"
        :style="{ borderColor: 'var(--rim)', background: 'var(--surface)', boxShadow: 'var(--card-shadow)' }"
      >
        <p
          class="text-center font-label text-[0.9375rem] uppercase tracking-[0.1em]"
          :style="{ color: 'var(--text-secondary)' }"
        >Доступ в контур</p>

        <div
          class="overflow-hidden rounded-xl border"
          :style="{
            background: 'var(--surface-2)',
            borderColor: error ? 'var(--sig-alarm)' : 'var(--line)',
            boxShadow: 'inset 0 1px 0 var(--rim-glow)',
          }"
        >
          <div class="flex min-h-[52px] items-center px-4">
            <input
              type="text"
              :value="login"
              readonly
              tabindex="-1"
              aria-readonly="true"
              autocomplete="off"
              class="w-full cursor-default select-none border-none bg-transparent font-mono text-[1rem] outline-none"
              :style="{ color: 'var(--text-secondary)' }"
            />
          </div>
          <div class="h-px" :style="{ background: 'var(--line)' }" aria-hidden="true"></div>
          <div class="relative flex min-h-[52px] items-center pl-4 pr-1">
            <input
              v-model="phrase"
              :type="show ? 'text' : 'password'"
              autocomplete="current-password"
              autocapitalize="off"
              spellcheck="false"
              placeholder="пароль"
              :aria-invalid="error ? 'true' : 'false'"
              :disabled="checking || unsupported"
              class="w-full border-none bg-transparent pr-2 font-mono text-[1rem] leading-[1.5] outline-none disabled:opacity-60"
              :class="masked ? 'tracking-[0.14em]' : 'tracking-normal'"
              :style="{ color: 'var(--text)' }"
            />
            <button
              type="button"
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 active:opacity-60"
              :style="{ color: 'var(--text-secondary)' }"
              :aria-label="show ? 'Скрыть пароль' : 'Показать пароль'"
              :aria-pressed="show ? 'true' : 'false'"
              tabindex="-1"
              @click="show = !show"
            >
              <svg viewBox="0 0 20 20" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                <path d="M1.8 10S4.9 4.6 10 4.6 18.2 10 18.2 10 15.1 15.4 10 15.4 1.8 10 1.8 10z" />
                <circle cx="10" cy="10" r="2.6" />
                <path v-if="show" d="M3 17 17 3" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div v-if="error || unsupported" role="alert">
          <p
            class="flex items-center justify-center gap-1.5 text-center text-[0.875rem]"
            :style="{ color: 'var(--sig-alarm)' }"
          >
            <span>{{ unsupported ? 'Браузер не даёт проверить пароль' : 'Неверный пароль' }}</span>
          </p>
          <p
            v-if="unsupported"
            class="mt-1.5 text-center text-[0.8125rem] leading-snug"
            :style="{ color: 'var(--text-secondary)' }"
          >Проверка требует защищённого соединения. Откройте приложение по https или с localhost.</p>
        </div>
        <p v-else-if="notice" class="text-center text-[0.875rem]" :style="{ color: 'var(--text-muted)' }">{{ notice }}</p>

        <button
          type="submit"
          :disabled="checking || unsupported"
          class="flex w-full items-center justify-center rounded-xl px-4 font-brand text-[1.125rem] font-semibold uppercase tracking-[0.12em] active:opacity-90 disabled:opacity-60"
          style="min-height: 52px"
          :style="{ background: 'var(--action)', color: 'var(--action-ink)' }"
        >
          <span class="kh-caps" style="--caps-track: 0.12em">{{ checking ? 'Проверяем…' : 'Войти' }}</span>
        </button>
      </div>

      <!-- ⛔ Эта строка обязана здесь стоять — и говорить правду о текущей
           архитектуре. До SYS-6 она честно называла вход заслоном; теперь
           данные шифруются, и честность в другом: назвать реальную границу
           стойкости, а не обещать «защищено» без оговорок. -->
      <p
        class="kh-balance mx-auto mt-5 max-w-[19rem] text-center text-[0.75rem] leading-relaxed"
        :style="{ color: 'var(--text-muted)' }"
      >
        Данные зашифрованы (AES-256-GCM), ключ выводится из пароля и нигде не хранится.
        Стойкость равна стойкости фразы — короткая перебирается по словарю.
      </p>
    </form>

    <div class="flex flex-1 flex-col items-center justify-end pb-10">
      <p class="text-center font-label text-[0.6875rem] uppercase tracking-[0.2em]" :style="{ color: 'var(--graphite)' }">
        Не заменяет врача
      </p>
    </div>
  </div>
</template>
