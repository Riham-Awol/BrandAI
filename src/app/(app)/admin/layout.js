import { PageHeader } from "@/components/layout/page-header";
import { AdminNav } from "@/components/admin/admin-nav";

export default function AdminLayout({ children }) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Administration" description="Brand AI as a whole: accounts, workspaces, plans, AI and the audit trail." />
      <AdminNav />
      {children}
    </div>
  );
}
