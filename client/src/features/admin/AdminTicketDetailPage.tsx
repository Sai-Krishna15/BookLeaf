import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { formatTicketNumber } from '@/lib/formatters';

export function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-1.5 -ml-2 text-muted-foreground"
        >
          <Link to="/admin/tickets">
            <ArrowLeft className="h-4 w-4" />
            Back to Queue
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Admin Triage: Ticket ${formatTicketNumber(id)}`}
        description="Ticket conversation, AI draft reply composer, internal notes, and triage controls."
      />

      <EmptyState
        icon={SlidersHorizontal}
        title="Admin Ticket Workspace"
        description="The two-column triage workspace with AI draft generator, editable composer, status overrides, and internal notes will be rendered here in Phase 11."
      />
    </div>
  );
}
export default AdminTicketDetailPage;
