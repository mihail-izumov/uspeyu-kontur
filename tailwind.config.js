/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      // Роли начертаний перенесены из «Где рост?» (runscale/gderost/app), но БЕЗ
      // брендовых файлов Univers: они лицензионные, а этот репозиторий публичный.
      // Роли сохранены, потому что на них построена вся типографика компонентов;
      // отличие только в том, что вместо брендового начертания сразу берётся
      // системное. Ни одного @font-face — значит ни одного шрифта по сети,
      // значит первый экран рисуется мгновенно и одинаково в офлайне.
      fontFamily: {
        // голос интерфейса: имя раздела, крупные действия, величины
        brand: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'system-ui', 'sans-serif'],
        // ярлыки приборов: подписи блоков и категорий, капс с разгонкой
        label: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'system-ui', 'sans-serif'],
        // данные и ввод: поля, коды показателей, цифры
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
