#!/bin/bash
# Обновляет копию приложения «Коллекция» (книги + винил) в public/collection/ из upstream-репозитория.
#
# Зачем патч: upstream рассчитан на раздачу по адресу со слэшем на конце
# (https://shimapa.github.io/bookshelf/). У нас Next.js отдаёт /collection без слэша,
# и относительные ссылки (app.css, app.js) резолвятся в корень сайта.
# Статический <base href="/collection/"> попадает в HTML до первой ссылки,
# поэтому его видит и спекулятивный парсер браузера.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC=https://raw.githubusercontent.com/shimapa/bookshelf/main

for f in index.html app.css app.js favicon.svg apple-touch-icon.png; do
  curl -fsSL "$SRC/$f" -o "public/collection/$f"
done

if grep -q '<base href="/collection/">' public/collection/index.html; then
  echo "base уже на месте — upstream починил сам, патч не нужен"
else
  perl -i -pe 's{(<meta charset="utf-8">)}{$1\n<base href="/collection/">} if $. < 10' public/collection/index.html
  grep -q '<base href="/collection/">' public/collection/index.html || { echo "ОШИБКА: не удалось вставить <base>"; exit 1; }
  echo "патч <base href=\"/collection/\"> применён"
fi

echo "готово. Проверь локально: npm run build && npx next start -p 3020 → http://localhost:3020/collection"
