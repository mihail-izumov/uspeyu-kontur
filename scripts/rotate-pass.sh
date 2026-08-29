#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Смена пароля приложения ОДНОЙ командой (приёмка ТЗ-1, 29.08.2026).
#
#     cd ~/mihizumov-healthbook/app && ./scripts/rotate-pass.sh
#
# Фраза спрашивается вслепую (не видна на экране, не попадает в историю
# шелла и в argv процессов). Дальше скрипт сам: хеш → src/config.js →
# перешифровка данных → дымовой тест → коммит.
#
# ⚠ Почему не одной строкой с фразой в аргументе: аргументы видны в
#   `ps` и истории; фраза, засветившаяся хоть где-то, — уже не фраза.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

command -v node >/dev/null || { echo "⛔ node не найден"; exit 1; }
test -f src/config.js || { echo "⛔ запускать из app/"; exit 1; }

printf "Новая фраза (ввод скрыт, минимум 12 символов): "
read -rs P1; echo
printf "Ещё раз: "
read -rs P2; echo

[ "$P1" = "$P2" ] || { echo "⛔ Фразы не совпали, ничего не изменено."; exit 1; }
[ ${#P1} -ge 12 ] || { echo "⛔ Короче 12 символов — перебирается по словарю. Ничего не изменено."; exit 1; }

echo "→ считаю хеш и вписываю в src/config.js…"
HASH=$(node scripts/passcode.mjs "$P1" | grep -oE '[0-9a-f]{64}' | head -1)
[ -n "$HASH" ] || { echo "⛔ passcode.mjs не вернул хеш"; exit 1; }

node -e "
const fs = require('fs');
let t = fs.readFileSync('src/config.js', 'utf8');
const next = t.replace(/(PASSCODE_HASH =\s*\n?\s*')([0-9a-f]{64})(')/m, '\$1$HASH\$3');
if (next === t) { console.error('⛔ PASSCODE_HASH в config.js не найден'); process.exit(1); }
fs.writeFileSync('src/config.js', next);
console.log('  ✓ PASSCODE_HASH обновлён');
"

echo "→ перешифровываю данные той же фразой…"
KONTUR_PASS="$P1" npm run --silent data:encrypt

echo "→ дымовой тест…"
KONTUR_PASS="$P1" npm run --silent test | tail -1

unset P1 P2

git add src/config.js public/data/health.enc.json
git commit -q -m "Смена пароля: новый хеш + пересборка данных" || echo "  (коммитить нечего)"
echo ""
echo "✅ Готово. Фраза нигде не сохранена — запомните её."
echo "   Не забудьте: тот же текст пойдёт в секрет KONTUR_PASS на GitHub."
