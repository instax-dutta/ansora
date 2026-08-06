import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { getSession } from "@/lib/auth/session";

/**
 * Auth guard for everything under /admin except /admin/login (which lives
 * outside this route group). Pages are dynamic because they read cookies.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await getSession())) redirect("/admin/login");

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <AdminHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
