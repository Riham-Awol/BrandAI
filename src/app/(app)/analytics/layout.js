import { PageHeader } from "@/components/layout/page-header";
import { AnalyticsNav } from "@/modules/analytics/components/analytics-nav";

export default function AnalyticsLayout({ children }) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Studio" title="Analytics & Insights" description="How your website, emails, posts and sales are doing — and what to do next." />
      <AnalyticsNav />
      {children}
    </div>
  );
}
