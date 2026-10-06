"use client";

import { useEffect, useState } from "react";

type Lang = "en" | "ru" | "nl";

const COMPANY_URLS: Record<string, string> = {
  "KYOCERA Document Solutions Europe": "https://www.kyoceradocumentsolutions.eu/",
  "Generium Pharmaceuticals": "https://generium.ru/en/",
};

const dict = {
  en: {
    seoTitle: "Pavel Shimansky — Corporate Finance & FP&A, Amsterdam",
    seoDescription:
      "FP&A, business partnering and corporate finance professional in Amsterdam. Planning and performance management, M&A, and finance automation with Power BI, Power Automate and AI tooling.",
    name: "Pavel Shimansky",
    title: "Corporate Finance & FP&A",
    subtitle: "Planning, performance and finance automation",
    intro:
      "Amsterdam-based finance professional with 9+ years across FP&A, M&A and business partnering in technology, pharma and healthcare. I build the planning and reporting systems behind better decisions — and, increasingly, the AI that runs them.",
    location: "Amsterdam, Netherlands",
    // TODO: ctaSecondary "Download CV" — hidden until a general-purpose CV PDF is chosen
    aboutLabel: "About",
    about: [
      "I work where financial planning meets technology. Day to day that means owning the annual planning cycle, product and gross-profit reporting, and partnering with commercial teams — then automating the parts that shouldn't need a person. Most recently I rebuilt five recurring reporting processes into an automated pipeline that frees up about a quarter of a full-time role.",
      "Before Amsterdam I led M&A at a healthcare group and ran finance for a biotech manufacturer. That's where I learned the number itself is rarely the point — what matters is the decision it changes.",
    ],
    expertiseLabel: "What I do",
    expertise: [
      {
        title: "Planning & performance",
        body: "Annual planning and budgeting, rolling forecasts, long-range planning, variance and performance analysis.",
      },
      {
        title: "Business partnering",
        body: "Working with commercial and operational teams on pricing, margin and product mix — translating financials into decisions people act on.",
      },
      {
        title: "Corporate finance & M&A",
        body: "Valuation, due diligence, investment and business cases, post-merger integration.",
      },
      {
        title: "Finance automation & AI",
        body: "Power BI, Power Query/DAX, Power Automate, Copilot Studio, AI Builder, Python — building the tooling, not just using it.",
      },
      {
        title: "Systems & data",
        body: "SAP S/4HANA, reporting data models, data quality and reporting standardisation across entities.",
      },
    ],
    experienceLabel: "Experience",
    experience: [
      {
        company: "KYOCERA Document Solutions Europe",
        role: "Corporate Finance Analyst",
        period: "Sep 2023 — present",
        meta: "Amsterdam, Netherlands",
        bullets: [
          "Run the annual Master Plan cycle end to end for the HQ entity — templates to divisions, collection of division and Sales input, consolidation, reporting to management — and consolidate a second entity's submissions.",
          "Product sales and gross-profit reporting across three business units, plus SG&A actual-vs-plan analysis.",
          "Finance business partner to a group IT services entity: sales and gross-profit analysis per customer and per tender.",
          "Power BI dashboards and data models used across Finance, Consolidation and HR.",
          "Automated five recurring reporting processes (Power Automate, Copilot Studio, AI Builder), freeing ~444 hours per year (≈0.25 FTE); author of an internal Finance & AI newsletter.",
        ],
      },
      {
        company: "Generium Pharmaceuticals",
        role: "Senior Finance Manager",
        period: "Mar 2018 — Sep 2023",
        meta: "Biotech",
        bullets: [
          "Owned budgeting, monthly reporting and forecasting cycles, with variance analysis for executive decision-making.",
          "Built and maintained integrated P&L, balance sheet and cash flow models used for long-range planning.",
          "Identified unprofitable long-term projects, enabling avoidance of ~$70M in inefficient investment.",
          "Optimised working capital and inventory structure, reducing unused stock by 15%.",
        ],
      },
      {
        company: "Medinvestgroup",
        role: "Head of M&A",
        period: "Mar 2021 — Dec 2022",
        meta: "Healthcare",
        bullets: [
          "Led and developed a two-person deal team across three transactions ($5–14M): valuation, due diligence and integration.",
          "Built financial models and investment cases supporting growth decisions.",
          "Delivered analysis that eliminated unprofitable activities, generating ~$10M in annual savings.",
        ],
      },
    ],
    educationLabel: "Education & credentials",
    education: [
      {
        school: "ESSEC Business School",
        degree: "MSc, Strategy & Management of International Business",
        place: "Paris & Singapore",
        year: "2016",
      },
      {
        school: "Financial University under the Government of the Russian Federation",
        degree: "BSc (Hons), Finance Management",
        place: "Moscow",
        year: "2015",
      },
    ],
    credentials: [
      "CFA — Level I passed, 2022",
      "Financial Modeling & Valuation Analyst (FMVA®)",
    ],
    languagesLabel: "Languages",
    languages:
      "Russian (native) · English (fluent) · French and Italian (upper-intermediate) · Dutch (learning)",
    petLabel: "Pet project",
    petTitle: "Bookshelf & records",
    petBody:
      "A web app for cataloguing my home library and vinyl records — barcode scanning, Goodreads ratings, search and stats.",
    contactLabel: "Contact",
    contactBody:
      "Based in Amsterdam, open to FP&A, business partnering and corporate finance roles in the Netherlands.",
  },
  ru: {
    seoTitle: "Павел Шиманский — корпоративные финансы и FP&A, Амстердам",
    seoDescription:
      "FP&A, бизнес-партнёрство и корпоративные финансы в Амстердаме. Планирование и управление эффективностью, M&A, автоматизация финансов на Power BI, Power Automate и AI.",
    name: "Павел Шиманский",
    title: "Корпоративные финансы и FP&A",
    subtitle: "Планирование, эффективность и автоматизация финансов",
    intro:
      "Финансист из Амстердама, 9+ лет в FP&A, M&A и бизнес-партнёрстве — в технологиях, фарме и здравоохранении. Строю системы планирования и отчётности, на которых держатся решения, — и всё чаще сам AI, который их обслуживает.",
    location: "Амстердам, Нидерланды",
    // TODO: ctaSecondary «Скачать резюме» — скрыта, пока не выбран общий PDF
    aboutLabel: "Обо мне",
    about: [
      "Работаю на стыке финансового планирования и технологий. На практике это годовой цикл планирования, отчётность по продуктам и валовой прибыли, бизнес-партнёрство с коммерческими командами — и автоматизация того, что не должно требовать человека. Недавно собрал из пяти рутинных процессов отчётности автоматизированный пайплайн, который освобождает примерно четверть ставки.",
      "До Амстердама руководил M&A в медицинской группе и финансами на биотех-производстве. Там и понял, что сама цифра редко имеет значение — важно решение, которое она меняет.",
    ],
    expertiseLabel: "Чем занимаюсь",
    expertise: [
      {
        title: "Планирование и эффективность",
        body: "Годовое планирование и бюджетирование, скользящие прогнозы, долгосрочное планирование, анализ отклонений и результатов.",
      },
      {
        title: "Бизнес-партнёрство",
        body: "Работа с коммерческими и операционными командами по цене, марже и продуктовому миксу — перевод финансов в решения, которые реально принимают.",
      },
      {
        title: "Корпоративные финансы и M&A",
        body: "Оценка, due diligence, инвестиционные и бизнес-кейсы, интеграция после сделки.",
      },
      {
        title: "Автоматизация финансов и AI",
        body: "Power BI, Power Query/DAX, Power Automate, Copilot Studio, AI Builder, Python — не просто пользуюсь инструментами, а собираю их.",
      },
      {
        title: "Системы и данные",
        body: "SAP S/4HANA, модели данных для отчётности, качество данных и стандартизация отчётности между юрлицами.",
      },
    ],
    experienceLabel: "Опыт",
    experience: [
      {
        company: "KYOCERA Document Solutions Europe",
        role: "Corporate Finance Analyst",
        period: "сен 2023 — наст. время",
        meta: "Амстердам, Нидерланды",
        bullets: [
          "Веду годовой цикл Master Plan от начала до конца для головной структуры — шаблоны дивизионам, сбор данных от дивизионов и Sales, консолидация, отчёт менеджменту — и консолидирую отчётность второго юрлица.",
          "Отчётность по продажам и валовой прибыли в разрезе трёх бизнес-юнитов, а также анализ SG&A «факт против плана».",
          "Финансовый бизнес-партнёр ИТ-сервисной структуры группы: анализ продаж и валовой прибыли по клиентам и тендерам.",
          "Дашборды и модели данных в Power BI, используемые Finance, Consolidation и HR.",
          "Автоматизировал пять регулярных процессов отчётности (Power Automate, Copilot Studio, AI Builder) — около 444 часов в год (≈0,25 ставки); автор внутренней рассылки Finance & AI.",
        ],
      },
      {
        company: "Generium Pharmaceuticals",
        role: "Senior Finance Manager",
        period: "мар 2018 — сен 2023",
        meta: "Биотех",
        bullets: [
          "Отвечал за бюджетирование, ежемесячную отчётность и прогнозирование, включая анализ отклонений для руководства.",
          "Построил и поддерживал интегрированные модели P&L, баланса и денежного потока для долгосрочного планирования.",
          "Выявил убыточные долгосрочные проекты, что позволило избежать ~$70 млн неэффективных инвестиций.",
          "Оптимизировал оборотный капитал и структуру запасов, сократив неиспользуемые остатки на 15%.",
        ],
      },
      {
        company: "Medinvestgroup",
        role: "Head of M&A",
        period: "мар 2021 — дек 2022",
        meta: "Здравоохранение",
        bullets: [
          "Руководил командой из двух человек в трёх сделках ($5–14 млн): оценка, due diligence, интеграция.",
          "Разрабатывал финансовые модели и инвестиционные кейсы для решений о росте.",
          "Подготовил анализ, позволивший отказаться от убыточных направлений, — ~$10 млн экономии в год.",
        ],
      },
    ],
    educationLabel: "Образование и квалификация",
    education: [
      {
        school: "ESSEC Business School",
        degree: "MSc, Strategy & Management of International Business",
        place: "Париж и Сингапур",
        year: "2016",
      },
      {
        school: "Финансовый университет при Правительстве РФ",
        degree: "BSc (с отличием), финансовый менеджмент",
        place: "Москва",
        year: "2015",
      },
    ],
    credentials: [
      "CFA — сдан Level I, 2022",
      "Financial Modeling & Valuation Analyst (FMVA®)",
    ],
    languagesLabel: "Языки",
    languages:
      "Русский (родной) · английский (свободно) · французский и итальянский (выше среднего) · нидерландский (изучаю)",
    petLabel: "Пет-проект",
    petTitle: "Книжная полка и пластинки",
    petBody:
      "Веб-приложение для каталога домашней библиотеки и виниловых пластинок — сканер штрихкодов, рейтинги Goodreads, поиск и статистика.",
    contactLabel: "Контакты",
    contactBody:
      "Живу в Амстердаме, открыт к позициям в FP&A, бизнес-партнёрстве и корпоративных финансах в Нидерландах.",
  },
  nl: {
    seoTitle: "Pavel Shimansky — Corporate Finance & FP&A, Amsterdam",
    seoDescription:
      "FP&A, business partnering en corporate finance in Amsterdam. Planning en performance management, M&A en finance-automatisering met Power BI, Power Automate en AI-tooling.",
    name: "Pavel Shimansky",
    title: "Corporate Finance & FP&A",
    subtitle: "Planning, performance en finance-automatisering",
    intro:
      "Finance professional in Amsterdam met 9+ jaar ervaring in FP&A, M&A en business partnering binnen technologie, farma en healthcare. Ik bouw de planning- en rapportagesystemen achter betere beslissingen — en steeds vaker ook de AI die ze draaiend houdt.",
    location: "Amsterdam, Nederland",
    // TODO: ctaSecondary "Download cv" — verborgen tot er een algemene cv-PDF is
    aboutLabel: "Over mij",
    about: [
      "Ik werk op het snijvlak van financiële planning en technologie. In de praktijk betekent dat: eigenaarschap over de jaarlijkse planningscyclus, product- en brutowinstrapportage en samenwerking met commerciële teams — en vervolgens automatiseren wat geen mens meer hoeft te doen. Recent heb ik vijf terugkerende rapportageprocessen omgebouwd tot een geautomatiseerde pipeline die ruwweg een kwart fte vrijmaakt.",
      "Vóór Amsterdam leidde ik M&A bij een healthcare-groep en was ik verantwoordelijk voor finance bij een biotechproducent. Daar leerde ik dat het getal zelf zelden het punt is — het gaat om de beslissing die het verandert.",
    ],
    expertiseLabel: "Wat ik doe",
    expertise: [
      {
        title: "Planning & performance",
        body: "Jaarplanning en budgettering, rolling forecasts, meerjarenplanning, variantie- en performanceanalyse.",
      },
      {
        title: "Business partnering",
        body: "Samenwerken met commerciële en operationele teams op prijs, marge en productmix — cijfers vertalen naar beslissingen waar mensen iets mee doen.",
      },
      {
        title: "Corporate finance & M&A",
        body: "Waardering, due diligence, investment- en business cases, post-merger integratie.",
      },
      {
        title: "Finance-automatisering & AI",
        body: "Power BI, Power Query/DAX, Power Automate, Copilot Studio, AI Builder, Python — ik gebruik de tooling niet alleen, ik bouw die ook.",
      },
      {
        title: "Systemen & data",
        body: "SAP S/4HANA, rapportagedatamodellen, datakwaliteit en standaardisatie van rapportage over entiteiten heen.",
      },
    ],
    experienceLabel: "Werkervaring",
    experience: [
      {
        company: "KYOCERA Document Solutions Europe",
        role: "Corporate Finance Analyst",
        period: "sep 2023 — heden",
        meta: "Amsterdam, Nederland",
        bullets: [
          "Voer de jaarlijkse Master Plan-cyclus end-to-end uit voor de hoofdentiteit — templates naar divisies, input ophalen bij divisies en Sales, consolideren en rapporteren aan het management — en consolideer de inzendingen van een tweede entiteit.",
          "Rapportage van productomzet en brutowinst over drie business units, plus SG&A-analyse (realisatie versus plan).",
          "Finance business partner van een IT-dienstenentiteit binnen de groep: omzet- en brutowinstanalyse per klant en per tender.",
          "Power BI-dashboards en datamodellen die worden gebruikt door Finance, Consolidation en HR.",
          "Vijf terugkerende rapportageprocessen geautomatiseerd (Power Automate, Copilot Studio, AI Builder), goed voor ~444 uur per jaar (≈0,25 fte); auteur van een interne Finance & AI-nieuwsbrief.",
        ],
      },
      {
        company: "Generium Pharmaceuticals",
        role: "Senior Finance Manager",
        period: "mrt 2018 — sep 2023",
        meta: "Biotech",
        bullets: [
          "Verantwoordelijk voor budgettering, maandrapportage en forecasting, inclusief variantieanalyse voor de directie.",
          "Geïntegreerde modellen voor P&L, balans en kasstroom gebouwd en onderhouden voor meerjarenplanning.",
          "Onrendabele langetermijnprojecten geïdentificeerd, waarmee ~$70 mln aan inefficiënte investeringen is voorkomen.",
          "Werkkapitaal en voorraadstructuur geoptimaliseerd; ongebruikte voorraad met 15% verlaagd.",
        ],
      },
      {
        company: "Medinvestgroup",
        role: "Head of M&A",
        period: "mrt 2021 — dec 2022",
        meta: "Healthcare",
        bullets: [
          "Leiding gegeven aan een dealteam van twee personen bij drie transacties ($5–14 mln): waardering, due diligence en integratie.",
          "Financiële modellen en investment cases opgesteld ter ondersteuning van groeibeslissingen.",
          "Analyses geleverd die onrendabele activiteiten elimineerden, met ~$10 mln aan jaarlijkse besparingen.",
        ],
      },
    ],
    educationLabel: "Opleiding & kwalificaties",
    education: [
      {
        school: "ESSEC Business School",
        degree: "MSc, Strategy & Management of International Business",
        place: "Parijs & Singapore",
        year: "2016",
      },
      {
        school: "Financial University under the Government of the Russian Federation",
        degree: "BSc (Hons), Finance Management",
        place: "Moskou",
        year: "2015",
      },
    ],
    credentials: [
      "CFA — Level I behaald, 2022",
      "Financial Modeling & Valuation Analyst (FMVA®)",
    ],
    languagesLabel: "Talen",
    languages:
      "Russisch (moedertaal) · Engels (vloeiend) · Frans en Italiaans (goede beheersing) · Nederlands (in ontwikkeling)",
    petLabel: "Hobbyproject",
    petTitle: "Bookshelf & records",
    petBody:
      "Een webapp om mijn thuisbibliotheek en vinylcollectie te catalogiseren — barcodescanner, Goodreads-ratings, zoeken en statistieken.",
    contactLabel: "Contact",
    contactBody:
      "Woonachtig in Amsterdam, open voor functies in FP&A, business partnering en corporate finance in Nederland.",
  },
} as const;

function highlightMetrics(text: string): string {
  return text.replace(
    /(\$\d+(?:[.,]\d+)*[MKB]?(?:\+)?(?:\s*[–—-]\s*\$?\d+(?:[.,]\d+)*[MKB]?(?:\+)?)?|[−\u2212-]\d+(?:[.,]\d+)*%|\b\d+(?:[.,]\d+)*%)/g,
    '<span class="font-semibold text-orange-600">$1</span>',
  );
}

export default function HomePage() {
  const [lang, setLang] = useState<Lang>("en");

  const t = dict[lang];

  // /collection is a separate app on the same origin that reads its language from
  // localStorage ("ru" or "en"); open it in Russian for RU, otherwise in English.
  const rememberCollectionLang = () => {
    try {
      localStorage.setItem("bookshelf.lang", lang === "ru" ? "ru" : "en");
    } catch {
      /* storage unavailable */
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.seoTitle;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t.seoDescription);
  }, [lang, t]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors">
      {/* Top bar */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-zinc-50/70 border-b border-zinc-200">
        <div className="mx-auto max-w-3xl px-6 py-3 flex items-center justify-between gap-3">
          <div className="text-zinc-500 text-xs font-mono tracking-widest uppercase">
            shimansky.nl
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 text-xs font-mono">
              {(["en", "ru", "nl"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 rounded-md transition-all uppercase tracking-wider ${
                    lang === l
                      ? "bg-orange-500/15 text-orange-600 border border-orange-500/30"
                      : "text-zinc-500 hover:text-zinc-900 border border-transparent"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.08),transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl px-6 pt-6 md:pt-12 pb-10 md:pb-12">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-orange-500/30 to-transparent blur-xl" />
              <img
                src="/pavel.jpg"
                alt="Pavel Shimansky"
                className="relative h-24 w-24 md:h-36 md:w-36 rounded-full object-cover ring-2 ring-zinc-200 shadow-2xl"
              />
            </div>
            <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight text-zinc-900">
              {t.name}
            </h1>
            <p className="mt-3 text-lg md:text-xl text-zinc-700 max-w-xl">
              {t.title}
            </p>
            <p className="mt-1 text-sm md:text-base text-zinc-500 max-w-xl">
              {t.subtitle}
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
              <PinIcon />
              {t.location}
            </div>
            <p className="mt-4 text-sm md:text-base text-zinc-700 leading-relaxed max-w-2xl">
              {t.intro}
            </p>

            {/* Quick contact buttons */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <ContactButton
                href="mailto:pavel@shimansky.nl"
                label="Email"
                icon={<MailIcon />}
              />
              <ContactButton
                href="https://www.linkedin.com/in/pavel-shimansky/"
                label="LinkedIn"
                icon={<LinkedInIcon />}
              />
              <ContactButton
                href="https://t.me/shimansky"
                label="Telegram"
                icon={<TelegramIcon />}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 pb-24 space-y-16 md:space-y-20">
        {/* About */}
        <Section label={t.aboutLabel}>
          <div className="space-y-4">
            {t.about.map((p, i) => (
              <p
                key={i}
                className="text-zinc-700 leading-relaxed text-base md:text-lg"
              >
                {p}
              </p>
            ))}
          </div>
        </Section>

        {/* Expertise */}
        <Section label={t.expertiseLabel}>
          <div className="grid sm:grid-cols-2 gap-3">
            {t.expertise.map((e) => (
              <div
                key={e.title}
                className="p-4 rounded-lg bg-white/60 border border-zinc-200"
              >
                <h3 className="text-zinc-900 font-semibold text-sm mb-1.5">
                  {e.title}
                </h3>
                <p className="text-zinc-600 text-sm leading-relaxed">
                  {e.body}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* Experience */}
        <Section label={t.experienceLabel}>
          <div className="space-y-8">
            {t.experience.map((job, i) => {
              const url = COMPANY_URLS[job.company];
              return (
                <div
                  key={i}
                  className="relative pl-6 border-l border-zinc-200 hover:border-orange-500/50 transition-colors"
                >
                  <div className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-zinc-300 ring-4 ring-zinc-50" />
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                    <h3 className="text-zinc-900 font-semibold text-lg">
                      {job.role}
                    </h3>
                    <div className="text-zinc-500 text-xs font-mono tracking-wider">
                      {job.period}
                    </div>
                  </div>
                  <div className="text-orange-600 text-sm font-medium mb-1">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline inline-flex items-center gap-1 group"
                      >
                        {job.company}
                        <ExternalIcon />
                      </a>
                    ) : (
                      job.company
                    )}
                  </div>
                  <div className="text-zinc-500 text-xs mb-3">{job.meta}</div>
                  <ul className="space-y-2">
                    {job.bullets.map((b, j) => (
                      <li
                        key={j}
                        className="text-zinc-600 text-sm leading-relaxed flex gap-3"
                      >
                        <span className="flex h-[1.625em] items-center shrink-0">
                          <span className="block h-1 w-1 rounded-full bg-orange-500/70" />
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: highlightMetrics(b) }} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Education */}
        <Section label={t.educationLabel}>
          <div className="space-y-5">
            {t.education.map((ed, i) => (
              <div key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                  <h3 className="text-zinc-900 font-semibold">
                    {ed.school}
                  </h3>
                  <div className="text-zinc-500 text-xs font-mono tracking-wider">
                    {ed.year}
                  </div>
                </div>
                <div className="text-zinc-600 text-sm">
                  {ed.degree} · {ed.place}
                </div>
              </div>
            ))}
          </div>
          <ul className="mt-6 space-y-1.5">
            {t.credentials.map((c) => (
              <li
                key={c}
                className="text-zinc-600 text-sm flex gap-2"
              >
                <span className="text-orange-500/70">✓</span>
                {c}
              </li>
            ))}
          </ul>
        </Section>

        {/* Languages */}
        <Section label={t.languagesLabel}>
          <p className="text-zinc-700 text-sm md:text-base leading-relaxed">
            {t.languages}
          </p>
        </Section>

        {/* Pet project */}
        <Section label={t.petLabel}>
          <a
            href="/collection"
            onClick={rememberCollectionLang}
            onAuxClick={rememberCollectionLang}
            className="block p-4 rounded-lg bg-white/60 border border-zinc-200 hover:bg-orange-500/5 hover:border-orange-500/30 transition-all group"
          >
            <h3 className="text-zinc-900 font-semibold text-sm mb-1.5">
              {t.petTitle}
            </h3>
            <p className="text-zinc-600 text-sm leading-relaxed">{t.petBody}</p>
            <div className="mt-3 text-orange-600 text-sm font-medium inline-flex items-center gap-1">
              shimansky.nl/collection
              <ExternalIcon />
            </div>
          </a>
        </Section>

        {/* Contact */}
        <Section label={t.contactLabel}>
          <p className="text-zinc-700 leading-relaxed mb-5">
            {t.contactBody}
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <ContactCard
              href="mailto:pavel@shimansky.nl"
              label="Email"
              value="pavel@shimansky.nl"
              icon={<MailIcon />}
            />
            <ContactCard
              href="https://www.linkedin.com/in/pavel-shimansky/"
              label="LinkedIn"
              value="pavel-shimansky"
              icon={<LinkedInIcon />}
            />
            <ContactCard
              href="https://t.me/shimansky"
              label="Telegram"
              value="@shimansky"
              icon={<TelegramIcon />}
            />
          </div>
        </Section>

        {/* Footer */}
        <div className="pt-8 border-t border-zinc-200 text-center text-zinc-500 text-xs font-mono tracking-wider">
          © {new Date().getFullYear()} · shimansky.nl
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="text-orange-600 text-[10px] md:text-xs font-mono tracking-[0.3em] uppercase mb-5">
        — {label}
      </div>
      {children}
    </section>
  );
}

function ContactButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-zinc-200 text-zinc-700 text-sm hover:bg-orange-500/5 hover:border-orange-500/40 hover:text-orange-600 transition-all"
    >
      {icon}
      {label}
    </a>
  );
}

function ContactCard({
  href,
  label,
  value,
  icon,
}: {
  href: string;
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="flex items-center gap-3 p-4 rounded-lg bg-white/60 border border-zinc-200 hover:bg-orange-500/5 hover:border-orange-500/30 transition-all group"
    >
      <span className="text-zinc-500 group-hover:text-orange-500 transition-colors">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-zinc-500 text-[10px] font-mono tracking-[0.2em] uppercase mb-1">
          {label}
        </div>
        <div className="text-zinc-800 text-sm group-hover:text-orange-600 transition-colors break-all">
          {value}
        </div>
      </div>
    </a>
  );
}

/* ─── Icons ──────────────────────────────────────────────────────── */

function PinIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      viewBox="0 0 24 24"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7l8.5 6 8.5-6" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      className="w-3 h-3 opacity-50 group-hover:opacity-100"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 5h5v5M19 5l-9 9M5 5h5M5 5v14h14v-5"
      />
    </svg>
  );
}
