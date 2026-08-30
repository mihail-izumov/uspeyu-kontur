<script setup>
/*
  Разметчик онбординга. Один на обе стороны витрины: публичную страницу и
  приватный экран «Как читать».

  ⛔ Текст здесь НЕ живёт. Мастер — `docs/ONBOARDING-gorizont.md` в контуре
  здоровья; генератор режет его по меткам `{публично}` / `{внутри}` и кладёт
  в public.json и uspeyu.json соответственно. Правка текста в этом файле —
  дефект: мастер и экран разойдутся молча, и через месяц будет непонятно,
  какая версия объяснения верна.

  ⚠ Компонент общий нарочно. Двумя копиями разметчик разошёлся бы по отступам
  и по обработке таблиц, и один и тот же абзац читался бы на двух экранах
  по-разному — а это один и тот же абзац из одного файла.

  Разметка нарочно бедная: заголовки, абзацы, списки, таблицы, **жирный** и
  `код`. Ничего, чем текст в мастере мог бы оформить себя произвольно.
*/
import { computed } from 'vue'

const props = defineProps({
  sections: { type: Array, default: () => [] },
})

function inline(s) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function blocks(body) {
  const out = []
  let table = null
  let list = null
  const flush = () => {
    if (table) { out.push({ kind: 'table', rows: table }); table = null }
    if (list) { out.push({ kind: 'list', items: list }); list = null }
  }
  for (const raw of String(body || '').split('\n')) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim())
      // Строка-разделитель шапки состоит только из дефисов и двоеточий —
      // её рисовать не нужно, она разметка, а не данные.
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue
      table = table || []
      table.push(cells.map(inline))
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      list = list || []
      list.push(inline(line.replace(/^[-*]\s+/, '')))
      continue
    }
    flush()
    out.push({ kind: 'p', html: inline(line) })
  }
  flush()
  return out
}

const parsed = computed(() => props.sections.map((s) => ({
  title: s.title,
  blocks: blocks(s.body),
})))
</script>

<template>
  <div v-for="(s, i) in parsed" :key="i" class="sec">
    <h3>{{ s.title }}</h3>
    <template v-for="(b, j) in s.blocks" :key="j">
      <p v-if="b.kind === 'p'" v-html="b.html"></p>
      <ul v-else-if="b.kind === 'list'">
        <li v-for="(it, k) in b.items" :key="k" v-html="it"></li>
      </ul>
      <div v-else class="tw">
        <table>
          <tr v-for="(row, k) in b.rows" :key="k">
            <component :is="k === 0 ? 'th' : 'td'" v-for="(c, m) in row" :key="m"
                       v-html="c"></component>
          </tr>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sec + .sec { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--line); }
h3 { font-size: 15.5px; margin-bottom: 8px; }
p { margin: 0 0 9px; font-size: 13.5px; line-height: 1.55; color: var(--text-secondary); }
p:last-child { margin-bottom: 0; }
ul { margin: 0 0 9px; padding-left: 18px; }
li { font-size: 13.5px; line-height: 1.5; color: var(--text-secondary); margin-bottom: 4px; }
/* Таблица шире экрана скроллится внутри своего контейнера, а не тащит
   за собой всю страницу вбок. */
.tw { overflow-x: auto; margin: 0 0 10px; }
table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--text-muted); font-weight: 500; }
code { font-size: 12px; background: var(--surface-2); padding: 1px 4px; border-radius: 4px; }
</style>
