# shimansky.nl

Персональная визитка Павла Шиманского — https://shimansky.nl

Также по тем же адресам отдаётся 301-редирект:
- https://shimanskii.nl
- https://shimanskaya.nl
- https://www.shimansky.nl (и др.)

## Стек

- Next.js 16 (App Router, standalone output)
- React 19, TypeScript
- Tailwind CSS v4
- i18n: EN / RU / NL (client-side, useState)
- Темы: dark / light с переключателем (localStorage)

## Структура

```
src/app/
├── layout.tsx       # html, метаданные, инит темы (no-flash скрипт в <head>)
├── globals.css      # tailwind v4 + @custom-variant dark
└── page.tsx         # вся визитка: dict EN/RU/NL, секции, иконки
public/
└── pavel.jpg        # фото для hero и og:image
```

Один файл `page.tsx` содержит:
- словари переводов (`dict.en/ru/nl`)
- маппинг компаний на URL (`COMPANY_URLS`)
- состояние языка и темы
- все секции (Hero, About, Experience, Education, Skills, Languages, Contact)
- встроенные SVG-иконки (Mail, LinkedIn, Telegram, Instagram, Pin, Sun, Moon, External)

## Локально запустить

```bash
npm install
npm run dev          # http://localhost:3000
```

Или через Docker:

```bash
docker compose up --build
# http://localhost:3020
```

## Деплой

С 2026-09-23 сайт живёт на своей отдельной ВМ — это сервер Павла, там можно менять что угодно,
другие сайты это не задевает.

```
браузер → shimansky.nl (DNS → 89.19.212.181, autopilot, TimeWeb Франкфурт)
        → nginx на autopilot: только TLS + проксирование, больше ничего
        → 65.108.45.139:443 → ВМ: nginx → контейнер 127.0.0.1:3020
```

Почему через прокси, а не DNS прямо на ВМ: ВМ стоит в Hetzner, а ТСПУ режет Hetzner из России
(соединение замирает после ~16 КБ — картинки и JS не догружаются). TimeWeb не режется.
Из NL/EU ВМ работает и напрямую.

**ВМ** (Ubuntu 24.04, 2 vCPU / 4 ГБ / 40 ГБ, бэкап раз в неделю):
- SSH: `ssh -p 2290 pavel@65.108.45.139` — только по ключу, `sudo` без пароля, `docker` без sudo
- Код: `/opt/shimansky.nl` (владелец `pavel`), контейнер `shimanskynl-app-1` на `127.0.0.1:3020`
- nginx: `/etc/nginx/sites-available/shimansky-nl` (сайт, `/books`, вебхук, редиректы зеркал),
  заголовки безопасности — `/etc/nginx/conf.d/security-headers.conf`
- Сертификат Let's Encrypt на 6 имён: certbot на ВМ, продлевается сам
  (проверка HTTP-01 приходит через прокси на autopilot)
- Зеркала `shimanskii.nl`, `shimanskaya.nl` и `www.*` → 301 на `shimansky.nl` (делает nginx ВМ)
- Сеть изолирована: из ВМ закрыты внутренние сети и SSH/RDP к серверам ОБРП, исходящий 25 порт
  (почту слать через API/587), есть лимит новых соединений. Интернет, GitHub, npm, Docker Hub — открыты.

### Обновить продакшн

Автоматически: push в `main` → GitHub webhook → `https://shimansky.nl/deploy-webhook` →
`webhook.service` на ВМ (от `pavel`) → `/usr/local/bin/deploy-shimansky-nl`
(`git pull --ff-only` + `docker compose up -d --build`). Лог: `/var/log/shimansky-nl-deploy.log`.

Руками на ВМ:

```bash
cd /opt/shimansky.nl && git pull && docker compose up -d --build
```

## Коллекция на /collection

Книги и винил Павла — https://shimansky.nl/collection

- Исходник: https://github.com/shimapa/bookshelf (статика, без сборки; там же живёт /books)
- Копия файлов лежит в `public/collection/`, rewrite `/collection` → `/collection/index.html`
  в `next.config.ts`
- Камера (сканер штрихкодов) требует послабления в nginx на ВМ — как у `/books`:
  в `sites-available/shimansky-nl` нужен `location /collection` с `Permissions-Policy: camera=(self)`
  и продублированными остальными пятью заголовками безопасности.

Обновить: `./scripts/update-collection.sh`, затем `git commit -am "update: collection" && git push`.

## Bookshelf на /books

Книжный трекер Павла — https://shimansky.nl/books

- Исходник: https://github.com/shimapa/bookshelf (статика, без сборки)
- Копия трёх файлов лежит в `public/books/`, rewrite `/books` → `/books/index.html` в `next.config.ts`
- В nginx на ВМ для `/books` разрешена камера: `Permissions-Policy: camera=(self)`.
  Общий заголовок (`camera=()`) задаётся в `/etc/nginx/conf.d/security-headers.conf` (уровень `http`),
  послабление — в двух `location` внутри `sites-available/shimansky-nl`. Там же продублированы
  все 6 заголовков: любой `add_header` в `location` отключает наследование с уровня `http`.
  Прокси на autopilot заголовки не добавляет — отдаёт те, что пришли с ВМ.

### Оценки Goodreads

`src/app/api/goodreads/route.ts` — `GET /api/goodreads?isbn=…` → `{ rating, ratingsCount, url }`
или `null`, если книги нет в Goodreads. У Goodreads нет публичного API и нет CORS, поэтому
браузер не может спросить его сам.

- CORS разрешён двум origin: `https://shimansky.nl` и `https://shimapa.github.io` (копия
  приложения на GitHub Pages ходит на этот же route).
- nginx менять не нужно — `/api/goodreads` идёт через обычный `location /`.
- Если Goodreads начнёт отвечать 403/429 (блок по IP датацентра), route вернёт 502, а
  приложение переключится на запасной публичный прокси. Проверить можно так:
  `curl -s "https://shimansky.nl/api/goodreads?isbn=9780735211292"` → `"rating":4.31`.

Локальная разработка: из некоторых сетей Goodreads недоступен (запрос виснет), тогда route
отдаёт 502 с текстом таймаута — это ограничение сети, а не ошибка кода. Проверять на проде.

### Обновить приложение

```bash
./scripts/update-books.sh    # перекачает 3 файла и переприменит патч <base>
npm run build && npx next start -p 3020   # проверить http://localhost:3020/books в браузере
git commit -am "update: bookshelf" && git push
```

Конфиг nginx при обновлениях менять не нужно.


## Что править где

| Что | Файл |
|---|---|
| Тексты на EN/RU/NL | `src/app/page.tsx` → `dict` |
| URL компаний | `src/app/page.tsx` → `COMPANY_URLS` |
| Контакты | `src/app/page.tsx` → секция Hero и Contact (mailto / t.me / instagram / linkedin) |
| Цвета темы | классы tailwind с парами `bg-zinc-50 dark:bg-zinc-950` |
| OG / SEO | `src/app/layout.tsx` → `metadata` |
| Фото | `public/pavel.jpg` |

## Контакты Павла (продублировано)

- Email: pavel@shimansky.nl
- LinkedIn: https://www.linkedin.com/in/pavel-shimansky/
- Telegram: @shimansky
- Instagram: @p_shimansky

<!-- auto-deploy test 1775713567 -->
