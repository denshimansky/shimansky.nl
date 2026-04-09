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

Проект развёрнут на VPS `89.19.212.181` в `/opt/shimansky.nl/`:
- Docker-контейнер `shimanskynl-app-1` на порту `127.0.0.1:3020`
- nginx-конфиг `/etc/nginx/sites-enabled/shimansky-nl` проксирует на 3020
- Let's Encrypt SAN-сертификат на 6 имён (3 домена + www)
- Зеркала `shimanskii.nl`, `shimanskaya.nl` → 301 на `shimansky.nl`

### Обновить продакшн

```bash
# с локальной машины
tar czf /tmp/shim-nl.tar.gz src/ public/
scp /tmp/shim-nl.tar.gz root@89.19.212.181:/tmp/
ssh root@89.19.212.181 "tar xzf /tmp/shim-nl.tar.gz -C /opt/shimansky.nl && \
  cd /opt/shimansky.nl && docker compose build && \
  docker compose up -d --force-recreate"
```

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
