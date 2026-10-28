import { PlusCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';

export function NewTicketPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Submit a Support Query"
        description="Select a book or general inquiry topic to reach our author support team."
      />
      <EmptyState
        icon={PlusCircle}
        title="New Ticket Composer"
        description="The support query submission form and attachment uploader will be implemented here in Phase 10."
      />
    </div>
  );
}
export default NewTicketPage;
