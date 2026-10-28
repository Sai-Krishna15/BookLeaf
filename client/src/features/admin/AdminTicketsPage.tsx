import { Inbox } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';

export function AdminTicketsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Ticket Queue"
        description="Filter, prioritize, and manage author support tickets across all categories."
      />
      <EmptyState
        icon={Inbox}
        title="Admin Ticket Queue Table"
        description="The live triage table with SLA urgency indicators, AI category/priority tags, and real-time updates will be rendered here in Phase 11."
      />
    </div>
  );
}
export default AdminTicketsPage;
