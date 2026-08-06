import { SettingsForm } from "@/components/admin/SettingsForm";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const config = await getSiteConfig();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Stored in <code className="rounded bg-surface-soft px-1.5 py-0.5 font-mono text-xs">content/site.config.json</code>{" "}
        and versioned like everything else.
      </p>
      <div className="mt-6">
        <SettingsForm initial={config} />
      </div>
    </div>
  );
}
