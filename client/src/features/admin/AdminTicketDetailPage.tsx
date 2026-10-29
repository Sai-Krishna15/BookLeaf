import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageSquare, Lock, ArrowLeft } from 'lucide-react';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TicketDetailHeader } from './components/detail/TicketDetailHeader';
import { ConversationThread } from './components/detail/ConversationThread';
import { ControlsCard } from './components/detail/ControlsCard';
import { AiAnalysisCard } from './components/detail/AiAnalysisCard';
import { AuthorBookFactsCard } from './components/detail/AuthorBookFactsCard';
import { ReplyTab } from './components/detail/ReplyTab';
import { InternalNotesTab } from './components/detail/InternalNotesTab';
import { useAdminTicket, useTicketMessages } from './hooks/useAdminDetail';
import { useAdminTicketDetailRealtime } from './hooks/useAdminTicketDetailRealtime';
import { ApiError } from '@/lib/api';

export function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ticketId = id || '';

  const {
    data: ticket,
    isLoading: ticketLoading,
    isError: ticketError,
    error: fetchError,
    refetch: refetchTicket,
  } = useAdminTicket(ticketId);

  const {
    data: messages,
    isLoading: messagesLoading,
  } = useTicketMessages(ticketId);

  const [hasNewAuthorMessage, setHasNewAuthorMessage] = React.useState(false);
  const [isDraftStale, setIsDraftStale] = React.useState(false);

  // Realtime hook for socket events
  useAdminTicketDetailRealtime({
    ticketId,
    onNewAuthorMessage: () => {
      setHasNewAuthorMessage(true);
      setIsDraftStale(true);
    },
    onAiReady: () => {
      refetchTicket();
    },
  });

  if (ticketLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-2">
        <div className="space-y-3 pb-2 border-b border-border">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </Card>
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (ticketError || !ticket) {
    const is404 = (fetchError as ApiError)?.status === 404;
    return (
      <div className="max-w-xl mx-auto py-12">
        <ErrorState
          title={is404 ? 'Ticket Not Found' : 'Unable to Load Ticket'}
          message={
            is404
              ? 'We could not find this ticket. It may have been deleted or does not exist.'
              : 'Failed to fetch ticket triage details. Please check your network and try again.'
          }
          onRetry={is404 ? undefined : () => refetchTicket()}
        />
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link to="/admin/tickets" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Queue
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-1">
      {/* 1. Header with back link, subject, age, status, priority, category badges */}
      <TicketDetailHeader ticket={ticket} />

      {/* 2. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Thread & Composer Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Conversation History Card */}
          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span>Conversation History</span>
                </span>
                <span className="text-xs text-muted-foreground font-normal">
                  {ticket.messageCount || 0} messages
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ConversationThread
                ticket={ticket}
                messages={messages}
                isLoading={messagesLoading}
                hasNewAuthorMessage={hasNewAuthorMessage}
                onClearNewAuthorMessage={() => setHasNewAuthorMessage(false)}
              />
            </CardContent>
          </Card>

          {/* Action Tabs: Reply to Author vs Internal Staff Notes */}
          <Card className="shadow-xs border-border bg-card rounded-xl">
            <CardContent className="pt-4">
              <Tabs defaultValue="reply" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/60 p-1 rounded-xl">
                  <TabsTrigger
                    value="reply"
                    className="gap-1.5 text-xs font-medium rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Reply to Author</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="notes"
                    className="gap-1.5 text-xs font-medium rounded-lg text-amber-900 dark:text-amber-300 data-[state=active]:bg-card data-[state=active]:text-amber-800 dark:data-[state=active]:text-amber-200 data-[state=active]:shadow-xs"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Internal Staff Note</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="reply" className="mt-0">
                  <ReplyTab ticket={ticket} isStale={isDraftStale} />
                </TabsContent>

                <TabsContent value="notes" className="mt-0">
                  <InternalNotesTab ticket={ticket} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Sticky Triage Controls, AI Analysis, and Author Facts */}
        <div className="space-y-6 lg:sticky lg:top-4">
          <ControlsCard ticket={ticket} />
          <AiAnalysisCard ticket={ticket} />
          <AuthorBookFactsCard ticket={ticket} />
        </div>
      </div>
    </div>
  );
}
export default AdminTicketDetailPage;
