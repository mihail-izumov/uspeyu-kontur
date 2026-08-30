<script setup>
/*
  ПУБЛИЧНАЯ ВХОДНАЯ СТРАНИЦА (Д-41, Д-42). Открывается без пароля.

  Состав сверху вниз задан ТЗ-2 §В и не переставляется по вкусу:
  шапка «Успею» → welcome-строка → Горизонт → календарь жизни →
  свежесть телеметрии → стрик → манифест → журнал версий → футер.

  ⛔ Каждое поле на этом экране обязано быть в docs/PUBLIC-WHITELIST.md §1.
  Захотелось показать ещё что-то — сперва решение владельца с кодом Д-NN
  в тот файл, потом поле в public.json, и только потом сюда. Обратный
  порядок — как раз тот, которым медкарта уезжает в интернет по кусочку.
*/
import { computed } from 'vue'
import HorizonCard from '../components/HorizonCard.vue'
import LifeCalendar from '../components/LifeCalendar.vue'
import ReadingBlocks from '../components/ReadingBlocks.vue'
import { plural } from '../composables/useData.js'

const props = defineProps({ pub: { type: Object, required: true } })

/* Свежесть телеметрии — единственный статус на публичной странице.
   Три ступени; цвет и слово всегда вместе (цвет не бывает единственным
   носителем смысла). */
const fresh = computed(() => {
  const d = props.pub.telemetry.draw_days
  if (d == null) return { kind: 'alarm', text: 'данных о заборах нет' }
  if (d <= 180) return { kind: 'ok', text: `данные обновлены ${d} ${plural(d, 'день', 'дня', 'дней')} назад` }
  if (d <= 548) return { kind: 'watch', text: `данным ${d} ${plural(d, 'день', 'дня', 'дней')}` }
  return { kind: 'alarm', text: `данным ${d} ${plural(d, 'день', 'дня', 'дней')} — картина устарела` }
})

const streak = computed(() => props.pub.weeks.streak)
</script>

<template>
  <div class="up-wrap">
    <!-- Шапка: одно слово, без «.ру» и без вопросительного знака (Д-40). -->
    <header class="hero">
      <h1>{{ pub.product.name }}</h1>
      <p class="welcome">{{ pub.product.welcome }}</p>
    </header>

    <HorizonCard :horizon="pub.horizon" />

    <!-- ⚠ Объяснение стоит СРАЗУ ПОД ЧИСЛОМ, а не в конце страницы и не за
         паролем (Д-43). Число видят раньше, чем объяснение, и реагируют на
         число; вилка без метода рядом — это тревога без управления. -->
    <div class="up-sec">Как читать</div>
    <section class="up-card">
      <ReadingBlocks :sections="(pub.onboarding && pub.onboarding.sections) || []" />
    </section>

    <div class="up-sec">Календарь жизни</div>
    <section class="up-card">
      <LifeCalendar
        :born="pub.weeks.born"
        :lived="pub.weeks.lived"
        :to-current-hi="pub.weeks.to_current_hi"
        :to-target-hi="pub.weeks.to_target_hi"
        :reviewed="pub.weeks.reviewed"
      />
    </section>

    <div class="up-sec">Телеметрия</div>
    <section class="up-card tele">
      <div class="chip" :class="fresh.kind">{{ fresh.text }}</div>
      <div class="trow">
        <span class="up-muted">Недель в зачёте подряд</span>
        <span class="up-digit">{{ streak }}</span>
      </div>
      <div class="trow">
        <span class="up-muted">Недельных отметок внесено</span>
        <span class="up-digit">{{ pub.telemetry.weeks_filled }}</span>
      </div>
      <p class="honest">
        Свежесть показана нарочно. Система, которая скрывает возраст своих данных,
        выглядит живее, чем есть, — и первым же несвежим числом обесценивает все остальные.
      </p>
    </section>

    <div class="up-sec">Метод</div>
    <section class="up-card">
      <p v-if="pub.manifest.draft" class="draft">
        ⚠ Черновик: текст метода ещё не принят владельцем.
      </p>
      <div v-for="(m, i) in pub.manifest.items" :key="i" class="thesis">
        <h3>{{ m.title }}</h3>
        <p>{{ m.text }}</p>
      </div>
    </section>

    <div class="up-sec">Версии</div>
    <section class="up-card">
      <div v-for="v in pub.versions" :key="v.date + v.version" class="ver">
        <span class="up-muted up-digit">{{ v.date }} · {{ v.version }}</span>
        <p>{{ v.text }}</p>
      </div>
    </section>

    <footer class="foot">
      <p class="motto">{{ pub.product.motto }}</p>
      <p class="author">{{ pub.product.author }}</p>
      <p class="up-muted note">{{ pub.product.author_note }}</p>
    </footer>
  </div>
</template>

<style scoped>
.hero { padding: 40px 0 22px; text-align: center; }
h1 { font-size: 34px; letter-spacing: -.03em; }
.welcome { margin: 8px 0 0; font-size: 14px; color: var(--text-muted); }

.tele { display: flex; flex-direction: column; gap: 10px; }
.chip {
  align-self: flex-start; font-size: 12.5px; font-weight: 600;
  padding: 5px 11px; border-radius: 999px;
}
.chip.ok { color: var(--sig-ok); background: var(--sig-ok-fill); }
.chip.watch { color: var(--sig-watch); background: var(--sig-watch-fill); }
.chip.alarm { color: var(--sig-alarm); background: var(--sig-alarm-fill); }
.trow { display: flex; justify-content: space-between; font-size: 14px; }
.honest { margin: 4px 0 0; font-size: 12px; color: var(--text-muted); line-height: 1.45; }

.draft {
  margin: 0 0 14px; font-size: 12.5px; color: var(--sig-watch);
  background: var(--sig-watch-fill); border-radius: 10px; padding: 8px 10px;
}
.thesis + .thesis { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); }
.thesis h3 { font-size: 15px; }
.thesis p { margin: 5px 0 0; font-size: 13.5px; line-height: 1.5; color: var(--text-secondary); }

.ver + .ver { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
.ver p { margin: 3px 0 0; font-size: 13px; color: var(--text-secondary); }
.ver .up-muted { font-size: 12px; }

.foot { margin-top: 44px; padding-top: 20px; border-top: 1px solid var(--line); text-align: center; }
.motto { margin: 0; font-size: 16px; font-weight: 600; }
.author { margin: 8px 0 0; font-size: 13px; }
.note { margin: 2px 0 0; font-size: 12px; }
</style>
