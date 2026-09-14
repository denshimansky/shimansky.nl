#!/bin/bash
# Обновляет копию приложения Bookshelf в public/books/ из upstream-репозитория.
#
# Зачем патч: upstream рассчитан на раздачу по адресу со слэшем на конце
# (https://shimapa.github.io/bookshelf/). У нас Next.js отдаёт /books без слэша,
# и относительные ссылки (app.css, app.js) резолвятся в корень сайта.
# Встроенный в index.html document.write('<base ...>') эту проблему не решает:
# спекулятивный парсер браузера запрашивает ассеты раньше, чем скрипт выполнится.
# Поэтому дописываем статический <base href="/books/"> — он попадает в HTML
# до первой ссылки и виден парсеру сразу.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC=https://raw.githubusercontent.com/shimapa/bookshelf/main

for f in index.html app.css app.js; do
  curl -fsSL "$SRC/$f" -o "public/books/$f"
done

if grep -q '<base href="/books/">' public/books/index.html; then
  echo "base уже на месте — upstream починил сам, патч не нужен"
else
  perl -i -pe 's{(<meta charset="utf-8">)}{$1\n<base href="/books/">} if $. < 10' public/books/index.html
  grep -q '<base href="/books/">' public/books/index.html || { echo "ОШИБКА: не удалось вставить <base>"; exit 1; }
  echo "патч <base href=\"/books/\"> применён"
fi

echo "готово. Проверь локально: npm run build && npx next start -p 3020 → http://localhost:3020/books"
