import type { Metadata } from "next";
import { Figtree, Fraunces, Geist_Mono } from "next/font/google";
import { getSiteConfig } from "@/lib/site-config";
import { buildThemeCss } from "@/lib/theme";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  // getSiteConfig() degrades to DEFAULT_SITE_CONFIG when the content
  // adapter is unreachable (see lib/site-config.ts), so prerendering and
  // metadata never fail a build; live requests use the real config.
  const config = await getSiteConfig();
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  return {
    metadataBase: new URL(baseUrl),
    title: { default: config.title, template: `%s · ${config.title}` },
    description: config.description,
    icons: { icon: "/icon.svg" },
    openGraph: {
      type: "website",
      siteName: config.title,
      title: config.title,
      description: config.description,
      url: baseUrl,
      ...(config.defaultOgImage ? { images: [{ url: config.defaultOgImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: config.title,
      description: config.description,
    },
  };
}

// Apply the saved/preferred theme before first paint to avoid a flash.
const themeInitScript = `try{var t=localStorage.getItem('ansora-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The site config carries the visual theme; the rendered style block
  // re-skins the whole app (public + admin) from the content repo's
  // site.config.json. `html:root` / `html.dark` selectors (see buildThemeCss)
  // outrank globals.css defaults, so this wins regardless of sheet order.
  // getSiteConfig() degrades to DEFAULT_SITE_CONFIG when the content
  // adapter is unreachable, so the style block never fails a build — live
  // requests use the real config.
  const config = await getSiteConfig();
  const themeCss = buildThemeCss(config.theme);

  return (
    <html
      lang="en"
      className={`${figtree.variable} ${fraunces.variable} ${geistMono.variable}`}
    >
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        <style>{themeCss}</style>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
