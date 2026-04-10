"use client";

import { useEffect, useState } from "react";

type Lang = "en" | "ru" | "nl";
type Theme = "dark" | "light";

const COMPANY_URLS: Record<string, string> = {
  "KYOCERA Document Solutions Europe": "https://www.kyoceradocumentsolutions.eu/",
  Generium: "https://generium.ru/en/",
  Mosinzhproekt: "https://mosinzhproekt.ru/en/",
  Мосинжпроект: "https://mosinzhproekt.ru/en/",
};

const dict = {
  en: {
    title: "FP&A & Corporate Finance Professional",
    location: "Amsterdam, Netherlands",
    aboutLabel: "About",
    about:
      "Finance professional with 9+ years of experience across budgeting, forecasting, financial analysis, management reporting, and business partnering in international and fast-evolving environments. Currently leading FP&A and corporate finance at KYOCERA Document Solutions Europe in Amsterdam.",
    experienceLabel: "Experience",
    educationLabel: "Education",
    skillsLabel: "Expertise",
    languagesLabel: "Languages",
    contactLabel: "Get in touch",
    name: "Pavel Shimansky",
    languages: [
      { name: "English", level: "Full Professional" },
      { name: "Russian", level: "Native" },
      { name: "French", level: "Professional Working" },
      { name: "Italian", level: "Limited Working" },
      { name: "Dutch", level: "Elementary" },
    ],
    skills: [
      "Corporate FP&A",
      "Budgeting & Forecasting",
      "Management Reporting",
      "Business Partnering",
      "Financial Modeling",
      "Power BI",
      "AI-powered Reporting",
      "M&A Support",
      "CFA Level I",
    ],
    experience: [
      {
        company: "KYOCERA Document Solutions Europe",
        role: "Corporate Finance Analyst",
        period: "Sep 2023 — Present",
        location: "Amsterdam, Netherlands",
        bullets: [
          "Lead budgeting, forecasting and strategic planning across OPEX, CAPEX and headcount.",
          "Finance partner to Sales & Product teams on pricing, product mix and margin performance.",
          "Built interactive Power BI dashboards and AI-powered variance analysis (−40% manual effort).",
          "Reduced discretionary costs by 7% through targeted spend controls.",
        ],
      },
      {
        company: "Generium",
        role: "Senior Finance Manager",
        period: "Mar 2022 — Sep 2023",
        location: "Moscow, Russia",
        bullets: [
          "Increased debt financing with leading banks and state funds, supporting M&A activity.",
          "Brokered a Joint Venture between Generium and Takeda Pharmaceuticals (hemophilia portfolio).",
          "Built financial models and option valuations for M&A deals generating $200M+ in revenue.",
        ],
      },
      {
        company: "Generium",
        role: "Financial Analyst",
        period: "Mar 2018 — Mar 2022",
        location: "Moscow, Russia",
        bullets: [
          "Budgeting and control over R&D projects.",
          "Built Power BI dashboards for R&D financial reporting.",
        ],
      },
      {
        company: "Medinvestgroup",
        role: "Head of Financial Analysis & Control",
        period: "May 2021 — Dec 2022",
        location: "Moscow, Russia",
        bullets: [
          "Closed three M&A deals on buy and sell sides ($5M–$14M).",
          "Built financial models and due diligence for one of the TOP-5 private clinic groups in Russia ($206M revenue).",
        ],
      },
      {
        company: "Mosinzhproekt",
        role: "Senior Specialist · Investment & International Affairs",
        period: "Jun 2016 — Mar 2018",
        location: "Moscow, Russia",
        bullets: [
          "Real estate market analysis and investment reporting for major Moscow urban projects.",
          "Managed advisor relationships across acquisitions, dispositions and contract compliance.",
        ],
      },
    ],
    education: [
      {
        school: "ESSEC Business School",
        degree: "Master's degree · Strategy & Management of International Business",
        period: "2015 — 2016",
      },
      {
        school: "Finance University under the Government of the Russian Federation",
        degree: "Bachelor's degree · Investment Management",
        period: "2011 — 2015",
      },
    ],
    certifications: [
      "Financial Modeling & Valuation Analyst (FMVA®)",
      "CFA Level I (Feb 2022)",
    ],
    certificationsLabel: "Certifications",
  },
  ru: {
    title: "Финансовый аналитик · FP&A и Corporate Finance",
    location: "Амстердам, Нидерланды",
    aboutLabel: "Обо мне",
    about:
      "Финансист с опытом более 9 лет в бюджетировании, прогнозировании, финансовом анализе и управленческой отчётности в международных и динамичных компаниях. Сейчас руковожу процессами FP&A и корпоративных финансов в KYOCERA Document Solutions Europe в Амстердаме.",
    experienceLabel: "Опыт работы",
    educationLabel: "Образование",
    skillsLabel: "Навыки",
    languagesLabel: "Языки",
    contactLabel: "Связаться",
    name: "Павел Шиманский",
    languages: [
      { name: "Английский", level: "C2 — свободно" },
      { name: "Русский", level: "Родной" },
      { name: "Французский", level: "C1 — продвинутый" },
      { name: "Итальянский", level: "B1 — базовый" },
      { name: "Нидерландский", level: "A1 — начальный" },
    ],
    skills: [
      "Corporate FP&A",
      "Бюджетирование и прогнозирование",
      "Управленческая отчётность",
      "Business Partnering",
      "Финансовое моделирование",
      "Power BI",
      "AI в отчётности",
      "Поддержка M&A",
      "CFA Level I",
    ],
    experience: [
      {
        company: "KYOCERA Document Solutions Europe",
        role: "Corporate Finance Analyst",
        period: "сент. 2023 — по н.в.",
        location: "Амстердам, Нидерланды",
        bullets: [
          "Веду бюджетирование, прогнозирование и стратегическое планирование по OPEX, CAPEX и численности.",
          "Финансовый партнёр для отделов продаж и продуктов: ценообразование, продуктовый микс, маржинальность.",
          "Построил интерактивные Power BI дашборды и AI-инструменты для variance analysis (−40% ручного труда).",
          "Снизил дискреционные расходы на 7% за счёт точечного контроля.",
        ],
      },
      {
        company: "Generium",
        role: "Senior Finance Manager",
        period: "март 2022 — сент. 2023",
        location: "Москва, Россия",
        bullets: [
          "Привлёк долговое финансирование от крупнейших банков и госфондов под M&A-сделки.",
          "Организовал совместное предприятие Generium и Takeda Pharmaceuticals (портфель препаратов от гемофилии).",
          "Финансовые модели и оценка опционов под M&A-сделки на $200M+ выручки.",
        ],
      },
      {
        company: "Generium",
        role: "Financial Analyst",
        period: "март 2018 — март 2022",
        location: "Москва, Россия",
        bullets: [
          "Бюджетирование и контроль R&D-проектов.",
          "Power BI дашборды для финансовой отчётности R&D.",
        ],
      },
      {
        company: "Medinvestgroup",
        role: "Head of Financial Analysis & Control",
        period: "май 2021 — дек. 2022",
        location: "Москва, Россия",
        bullets: [
          "Закрыл три M&A-сделки на стороне покупателя и продавца ($5M–$14M).",
          "Финансовые модели и due diligence для одной из ТОП-5 групп частных клиник России ($206M выручки).",
        ],
      },
      {
        company: "Мосинжпроект",
        role: "Старший специалист · Инвестиции и международные отношения",
        period: "июнь 2016 — март 2018",
        location: "Москва, Россия",
        bullets: [
          "Анализ рынка недвижимости и инвестиционная отчётность по крупным городским проектам Москвы.",
          "Управление отношениями с консультантами по сделкам и контрактному комплаенсу.",
        ],
      },
    ],
    education: [
      {
        school: "ESSEC Business School",
        degree: "Магистр · Стратегия и управление международным бизнесом",
        period: "2015 — 2016",
      },
      {
        school: "Финансовый университет при Правительстве РФ",
        degree: "Бакалавр · Управление инвестициями",
        period: "2011 — 2015",
      },
    ],
    certifications: [
      "Financial Modeling & Valuation Analyst (FMVA®)",
      "CFA Level I (февраль 2022)",
    ],
    certificationsLabel: "Сертификаты",
  },
  nl: {
    title: "FP&A & Corporate Finance Professional",
    location: "Amsterdam, Nederland",
    aboutLabel: "Over mij",
    about:
      "Finance professional met meer dan 9 jaar ervaring in budgettering, forecasting, financiële analyse, management reporting en business partnering binnen internationale en snel veranderende omgevingen. Momenteel verantwoordelijk voor FP&A en corporate finance bij KYOCERA Document Solutions Europe in Amsterdam.",
    experienceLabel: "Werkervaring",
    educationLabel: "Opleiding",
    skillsLabel: "Expertise",
    languagesLabel: "Talen",
    contactLabel: "Contact",
    name: "Pavel Shimansky",
    languages: [
      { name: "Engels", level: "Volledig professioneel" },
      { name: "Russisch", level: "Moedertaal" },
      { name: "Frans", level: "Professioneel" },
      { name: "Italiaans", level: "Basis" },
      { name: "Nederlands", level: "Beginner" },
    ],
    skills: [
      "Corporate FP&A",
      "Budgettering & Forecasting",
      "Management Reporting",
      "Business Partnering",
      "Financial Modeling",
      "Power BI",
      "AI-gedreven rapportage",
      "M&A Support",
      "CFA Level I",
    ],
    experience: [
      {
        company: "KYOCERA Document Solutions Europe",
        role: "Corporate Finance Analyst",
        period: "sep 2023 — Heden",
        location: "Amsterdam, Nederland",
        bullets: [
          "Leid budgettering, forecasting en strategische planning voor OPEX, CAPEX en headcount.",
          "Finance partner voor Sales- en Productteams op het gebied van pricing, product mix en marges.",
          "Interactieve Power BI dashboards en AI-tools voor variance analyse gebouwd (−40% handmatig werk).",
          "Discretionaire kosten met 7% verlaagd via gerichte uitgavencontroles.",
        ],
      },
      {
        company: "Generium",
        role: "Senior Finance Manager",
        period: "mrt 2022 — sep 2023",
        location: "Moskou, Rusland",
        bullets: [
          "Schuldfinanciering bij grote banken en staatsfondsen voor M&A-activiteiten.",
          "Joint Venture tussen Generium en Takeda Pharmaceuticals tot stand gebracht (hemofilie-portfolio).",
          "Financiële modellen en optiewaardering voor M&A-deals met $200M+ omzet.",
        ],
      },
      {
        company: "Generium",
        role: "Financial Analyst",
        period: "mrt 2018 — mrt 2022",
        location: "Moskou, Rusland",
        bullets: [
          "Budgettering en controle van R&D-projecten.",
          "Power BI dashboards voor R&D financiële rapportage.",
        ],
      },
      {
        company: "Medinvestgroup",
        role: "Head of Financial Analysis & Control",
        period: "mei 2021 — dec 2022",
        location: "Moskou, Rusland",
        bullets: [
          "Drie M&A-deals afgerond aan koop- en verkoopzijde ($5M–$14M).",
          "Financiële modellen en due diligence voor één van de TOP-5 private kliniekgroepen in Rusland ($206M omzet).",
        ],
      },
      {
        company: "Mosinzhproekt",
        role: "Senior Specialist · Investeringen & Internationale Zaken",
        period: "jun 2016 — mrt 2018",
        location: "Moskou, Rusland",
        bullets: [
          "Vastgoedmarktanalyse en investeringsrapportage voor grote stedelijke projecten in Moskou.",
          "Beheer van adviseursrelaties bij acquisities, desinvesteringen en contractcompliance.",
        ],
      },
    ],
    education: [
      {
        school: "ESSEC Business School",
        degree: "Master · Strategy & Management of International Business",
        period: "2015 — 2016",
      },
      {
        school: "Finance University under the Government of the Russian Federation",
        degree: "Bachelor · Investment Management",
        period: "2011 — 2015",
      },
    ],
    certifications: [
      "Financial Modeling & Valuation Analyst (FMVA®)",
      "CFA Level I (feb 2022)",
    ],
    certificationsLabel: "Certificeringen",
  },
} as const;

function highlightMetrics(text: string): string {
  return text.replace(
    /(\$\d+(?:[.,]\d+)*[MKB]?(?:\+)?(?:\s*[–—-]\s*\$?\d+(?:[.,]\d+)*[MKB]?(?:\+)?)?|[−\u2212-]\d+(?:[.,]\d+)*%|\b\d+(?:[.,]\d+)*%)/g,
    '<span class="font-semibold text-orange-600 dark:text-orange-300">$1</span>',
  );
}

export default function HomePage() {
  const [lang, setLang] = useState<Lang>("en");
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) || "dark";
    setTheme(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme, mounted]);

  const t = dict[lang];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 transition-colors">
      {/* Top bar */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-zinc-50/70 dark:bg-zinc-950/70 border-b border-zinc-200 dark:border-zinc-800/50">
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
                      ? "bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300 border border-orange-500/30"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.08),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.06),transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl px-6 pt-16 md:pt-24 pb-12 md:pb-16">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-orange-500/30 to-transparent blur-xl" />
              <img
                src="/pavel.jpg"
                alt="Pavel Shimansky"
                className="relative h-36 w-36 md:h-44 md:w-44 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-800 shadow-2xl"
              />
            </div>
            <h1 className="mt-8 text-4xl md:text-6xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t.name}
            </h1>
            <p className="mt-4 text-lg md:text-xl text-zinc-700 dark:text-zinc-300 max-w-xl">
              {t.title}
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
              <PinIcon />
              {t.location}
            </div>

            {/* Quick contact buttons */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
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
              <ContactButton
                href="https://instagram.com/p_shimansky"
                label="Instagram"
                icon={<InstagramIcon />}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-6 pb-24 space-y-16 md:space-y-20">
        {/* About */}
        <Section label={t.aboutLabel}>
          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-base md:text-lg">
            {t.about}
          </p>
        </Section>

        {/* Experience */}
        <Section label={t.experienceLabel}>
          <div className="space-y-8">
            {t.experience.map((job, i) => {
              const url = COMPANY_URLS[job.company];
              return (
                <div
                  key={i}
                  className="relative pl-6 border-l border-zinc-200 dark:border-zinc-800 hover:border-orange-500/50 transition-colors"
                >
                  <div className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700 ring-4 ring-zinc-50 dark:ring-zinc-950" />
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                    <h3 className="text-zinc-900 dark:text-zinc-100 font-semibold text-lg">
                      {job.role}
                    </h3>
                    <div className="text-zinc-500 text-xs font-mono tracking-wider">
                      {job.period}
                    </div>
                  </div>
                  <div className="text-orange-600 dark:text-orange-300/90 text-sm font-medium mb-1">
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
                  <div className="text-zinc-500 text-xs mb-3">{job.location}</div>
                  <ul className="space-y-2">
                    {job.bullets.map((b, j) => (
                      <li
                        key={j}
                        className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed flex gap-3"
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
                  <h3 className="text-zinc-900 dark:text-zinc-100 font-semibold">
                    {ed.school}
                  </h3>
                  <div className="text-zinc-500 text-xs font-mono tracking-wider">
                    {ed.period}
                  </div>
                </div>
                <div className="text-zinc-600 dark:text-zinc-400 text-sm">
                  {ed.degree}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Skills + Languages */}
        <div className="grid md:grid-cols-2 gap-12">
          <Section label={t.skillsLabel}>
            <div className="flex flex-wrap gap-2">
              {t.skills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs"
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-6">
              <div className="text-zinc-500 text-[10px] font-mono tracking-[0.2em] uppercase mb-3">
                {t.certificationsLabel}
              </div>
              <ul className="space-y-1.5">
                {t.certifications.map((c) => (
                  <li
                    key={c}
                    className="text-zinc-600 dark:text-zinc-400 text-sm flex gap-2"
                  >
                    <span className="text-orange-500/70">✓</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          <Section label={t.languagesLabel}>
            <ul className="space-y-2">
              {t.languages.map((l) => (
                <li key={l.name} className="flex justify-between text-sm">
                  <span className="text-zinc-800 dark:text-zinc-200">{l.name}</span>
                  <span className="text-zinc-500">{l.level}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        {/* Contact */}
        <Section label={t.contactLabel}>
          <div className="grid sm:grid-cols-2 gap-3">
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
            <ContactCard
              href="https://instagram.com/p_shimansky"
              label="Instagram"
              value="@p_shimansky"
              icon={<InstagramIcon />}
            />
          </div>
        </Section>

        {/* Footer */}
        <div className="pt-8 border-t border-zinc-200 dark:border-zinc-900 text-center text-zinc-500 dark:text-zinc-600 text-xs font-mono tracking-wider">
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
      <div className="text-orange-600 dark:text-orange-400/80 text-[10px] md:text-xs font-mono tracking-[0.3em] uppercase mb-5">
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
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm hover:bg-orange-500/5 dark:hover:bg-orange-500/10 hover:border-orange-500/40 hover:text-orange-600 dark:hover:text-orange-300 transition-all"
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
      className="flex items-center gap-3 p-4 rounded-lg bg-white/60 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:bg-orange-500/5 hover:border-orange-500/30 transition-all group"
    >
      <span className="text-zinc-500 group-hover:text-orange-500 transition-colors">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-zinc-500 text-[10px] font-mono tracking-[0.2em] uppercase mb-1">
          {label}
        </div>
        <div className="text-zinc-800 dark:text-zinc-200 text-sm group-hover:text-orange-600 dark:group-hover:text-orange-300 transition-colors break-all">
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

function InstagramIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      viewBox="0 0 24 24"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
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

function SunIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
      />
    </svg>
  );
}
