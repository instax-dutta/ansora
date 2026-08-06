import type { Metadata } from "next";
import { Figtree, Fraunces, Geist_Mono } from "next/font/google";
import { getSiteConfig } from "@/lib/site-config";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${fraunces.variable} ${geistMono.variable}`}
    >
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
