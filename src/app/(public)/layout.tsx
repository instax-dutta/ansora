import { AnalyticsScript } from "@/components/AnalyticsScript";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { resolveAnalyticsConfig } from "@/lib/analytics/resolve";
import { getSiteConfig } from "@/lib/site-config";

/**
 * Public shell.
 *
 * The analytics tracker is mounted here and only here, which is what keeps it
 * off `/admin`, `/api` and the `/md` mirror — none of them render this layout.
 * When analytics is disabled the component returns null, so a public page makes
 * exactly zero analytics requests.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolvedAnalytics = resolveAnalyticsConfig(await getSiteConfig());

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <AnalyticsScript resolved={resolvedAnalytics} />
    </div>
  );
}
