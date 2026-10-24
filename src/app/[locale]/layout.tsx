import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import "@fontsource-variable/nunito";
import "@fontsource-variable/noto-sans-kr";
import "@fontsource-variable/noto-sans-arabic";
import "../globals.css";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { PersistentUiState } from "@/components/layout/PersistentUiState";
import { UiInit } from "@/components/layout/UiInit";
import { BottomNav } from "@/components/layout/NavLinks";
import { getLanguages, getSettings } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getLanguageInfo } from "@/lib/i18n/languages";
import { pick } from "@/lib/i18n/localized";

export async function generateStaticParams() {
  const languages = await getLanguages();
  return languages.filter((l) => l.enabled).map((l) => ({ locale: l.code }));
}

export async function generateMetadata(): Promise<Metadata> {
  const [settings, currentLocale] = await Promise.all([
    getSettings(),
    rootLocale(),
  ]);
  const name = pick(settings.kingdomName, currentLocale);
  return {
    title: { default: name, template: `%s · ${name}` },
    description: pick(settings.tagline, currentLocale),
    applicationName: name,
    // The whole site is hidden from search engines (see also app/robots.ts).
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false },
    },
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaf2ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1627" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const FONT_CLASS: Record<string, string> = {
  latin: "",
  korean: "font-korean",
  arabic: "font-arabic",
  japanese: "font-japanese",
  chinese: "font-chinese",
};

export default async function RootLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const currentLocale = await rootLocale();
  const [languages, settings] = await Promise.all([
    getLanguages(),
    getSettings(),
  ]);

  const language = languages.find((l) => l.code === currentLocale && l.enabled);
  if (!language) notFound();

  const dict = await getDictionary(currentLocale);
  const info = getLanguageInfo(currentLocale);
  const kingdomName = pick(settings.kingdomName, currentLocale);

  return (
    <html
      lang={currentLocale}
      dir={info.direction}
      className={`${FONT_CLASS[info.font] ?? ""} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme and text size before the first paint (no flash); see UiInit. */}
        <UiInit />
      </head>
      {/* suppressHydrationWarning: browser extensions (Grammarly, ...) add attributes to <body>
          before React hydrates; the mismatch is harmless and only concerns this element. */}
      <body className="flex min-h-full flex-col pb-24 lg:pb-0" suppressHydrationWarning>
        <PersistentUiState locale={currentLocale} />
        <Header
            locale={currentLocale}
            languages={languages.filter((l) => l.enabled)}
            dict={dict}
            kingdomName={kingdomName}
            kingdomNumber={settings.kingdomNumber}
            adminHref={`/${currentLocale}/admin`}
          />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 md:pt-10">
            {/* Route changes crossfade through the <ViewTransition> in template.tsx; language
                switches through withNavigationTransition() in the language switcher. */}
            {children}
          </main>
        <Footer
            dict={dict}
            discordUrl={settings.discordInviteUrl}
            joinLabel={dict["home.joinDiscord"]}
            createdBy={settings.createdBy}
            adminHref={`/${currentLocale}/admin`}
          />
        <BottomNav locale={currentLocale} dict={dict} />
      </body>
    </html>
  );
}
