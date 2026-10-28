import { Ticket, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

export function TicketsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Support Tickets"
        description="Track your inquiries and communications with the BookLeaf support team."
        actions={
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/tickets/new">
              <Plus className="h-4 w-4" />
              New Support Query
            </Link>
          </Button>
        }
      />
      <EmptyState
        icon={Ticket}
        title="Author Tickets List"
        description="Your support queries and conversation threads will be rendered here in Phase 10."
      />
    </div>
  );
}
export default TicketsPage;
