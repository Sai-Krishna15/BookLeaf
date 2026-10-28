import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { formatTicketNumber } from '@/lib/formatters';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to="/tickets">
            <ArrowLeft className="h-4 w-4" />
            Back to Tickets
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Ticket ${formatTicketNumber(id)}`}
        description="Ticket conversation thread and status updates."
      />

      <EmptyState
        icon={MessageSquare}
        title="Ticket Conversation View"
        description="The live author conversation thread and reply history will be rendered here in Phase 10."
      />
    </div>
  );
}
export default TicketDetailPage;
