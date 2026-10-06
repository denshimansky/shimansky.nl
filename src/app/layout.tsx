import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Pavel Shimansky — Corporate Finance & FP&A, Amsterdam",
  description:
    "FP&A, business partnering and corporate finance professional in Amsterdam. Planning and performance management, M&A, and finance automation with Power BI, Power Automate and AI tooling.",
  metadataBase: new URL("https://shimansky.nl"),
  openGraph: {
    type: "profile",
    locale: "en_US",
    url: "https://shimansky.nl",
    siteName: "Pavel Shimansky",
    title: "Pavel Shimansky — Corporate Finance & FP&A, Amsterdam",
    description:
      "FP&A, business partnering and corporate finance professional in Amsterdam. Planning and performance management, M&A, and finance automation with Power BI, Power Automate and AI tooling.",
    images: [
      {
        url: "/pavel.jpg",
        width: 400,
        height: 400,
        alt: "Pavel Shimansky",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Pavel Shimansky — Corporate Finance & FP&A, Amsterdam",
    description:
      "FP&A, business partnering and corporate finance professional in Amsterdam. Planning and performance management, M&A, and finance automation with Power BI, Power Automate and AI tooling.",
    images: ["/pavel.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased dark`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-zinc-50 dark:bg-zinc-950">{children}</body>
    </html>
  );
}
