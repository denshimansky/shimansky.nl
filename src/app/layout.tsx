import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Pavel Shimansky — FP&A & Corporate Finance Professional",
  description:
    "Pavel Shimansky · FP&A and Corporate Finance professional with 9+ years of experience. Currently at KYOCERA Document Solutions Europe in Amsterdam.",
  metadataBase: new URL("https://shimansky.nl"),
  openGraph: {
    type: "profile",
    locale: "en_US",
    url: "https://shimansky.nl",
    siteName: "Pavel Shimansky",
    title: "Pavel Shimansky — FP&A & Corporate Finance Professional",
    description:
      "FP&A and Corporate Finance professional with 9+ years of experience. Amsterdam, Netherlands.",
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
    title: "Pavel Shimansky — FP&A & Corporate Finance Professional",
    description:
      "FP&A and Corporate Finance professional. Amsterdam, Netherlands.",
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
