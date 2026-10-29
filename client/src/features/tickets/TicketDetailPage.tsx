import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Send,
  Loader2,
  Calendar,
  AlertCircle,
  ArrowDown,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TicketStatusNote } from '@/components/common/TicketStatusNote';
import { MessageBubble } from '@/components/common/MessageBubble';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTicket, useTicketMessages, useSendFollowUp } from './hooks/useTickets';
import { useUnreadTickets } from './hooks/useAuthorTicketRealtime';
import { formatDateTime, formatTicketNumber } from '@/lib/formatters';
import { ApiError } from '@/lib/api';
import type { TicketStatus } from './types';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ticketId = id || '';

  const { markAsRead } = useUnreadTickets();
  const {
    data: ticket,
    isLoading: ticketLoading,
    isError: ticketError,
    error: fetchError,
    refetch: refetchTicket,
  } = useTicket(ticketId);
  const { data: messages, isLoading: messagesLoading } = useTicketMessages(ticketId);
  const sendFollowUpMutation = useSendFollowUp(ticketId);

  const [replyText, setReplyText] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [showScrollBottomPill, setShowScrollBottomPill] = React.useState(false);

  const threadEndRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Mark ticket as read when opened
  React.useEffect(() => {
    if (ticketId) {
      markAsRead(ticketId);
    }
  }, [ticketId, markAsRead]);

  // Initial scroll to bottom when thread loads
  React.useEffect(() => {
    if (!messagesLoading && messages) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesLoading, messages]);

  // Handle scroll detection for the floating "New response" pill
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollBottomPill(!isNearBottom);
  };

  const scrollToBottom = () => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottomPill(false);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed) return;

    if (trimmed.length > 5000) {
      setErrorMessage('Your reply cannot exceed 5000 characters.');
      return;
    }

    setErrorMessage(null);

    try {
      await sendFollowUpMutation.mutateAsync({ body: trimmed });
      setReplyText('');
      toast.success('Your reply has been sent.');
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setErrorMessage('This ticket is currently closed and cannot receive replies.');
        } else {
          setErrorMessage(err.message || 'Failed to deliver your message.');
        }
      } else {
        setErrorMessage('Failed to send reply. Please try again.');
      }
    }
  };

  if (ticketLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Card className="p-6 space-y-4 border-border/80 shadow-xs">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
        </Card>
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
              ? "We could not find this ticket. It may not exist, or you may not have permission to view another author's ticket."
              : 'We could not load this ticket at this time. Please check your connection and try again.'
          }
          onRetry={is404 ? undefined : () => refetchTicket()}
        />
        <div className="mt-4 text-center">
          <Button asChild variant="outline" size="sm">
            <Link to="/tickets">Return to My Tickets</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isClosed = ticket.status === 'CLOSED';
  const isResolved = ticket.status === 'RESOLVED';

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
          <Link to="/tickets">
            <ArrowLeft className="h-4 w-4" />
            Back to Tickets
          </Link>
        </Button>

        <span className="text-xs font-mono font-semibold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border/60 shadow-xs">
          Ticket {formatTicketNumber(ticket.ticketNumber)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{ticket.subject}</h1>
          <StatusBadge status={ticket.status as TicketStatus} className="text-xs px-3 py-1 shadow-xs" />
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {ticket.book ? (
            <div className="flex items-center gap-1.5 text-foreground font-medium">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{ticket.book.title}</span>
            </div>
          ) : (
            <span className="font-medium">General / Account Level</span>
          )}

          <div className="flex items-center gap-1.5 tabular-nums">
            <Calendar className="h-3.5 w-3.5" />
            <span>Created {formatDateTime(ticket.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Status Explanation Banner */}
      <TicketStatusNote status={ticket.status as TicketStatus} />

      {/* Conversation Thread Container */}
      <Card className="border border-border/80 shadow-xs overflow-hidden flex flex-col bg-card">
        <CardHeader className="p-4 border-b border-border/80 bg-muted/30 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Conversation Thread
          </CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {messages ? `${messages.length + 1} messages` : 'Loading messages...'}
          </span>
        </CardHeader>

        <CardContent
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="p-6 space-y-6 max-h-[600px] overflow-y-auto relative"
        >
          {/* 1. Original Query Bubble */}
          <MessageBubble
            senderName="You"
            senderRole="AUTHOR"
            body={ticket.description}
            createdAt={ticket.createdAt}
            attachments={ticket.attachments}
            isOriginalQuery={true}
          />

          {/* 2. Messages List */}
          {messagesLoading && (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-16 w-3/4 ml-auto" />
              <Skeleton className="h-16 w-3/4" />
            </div>
          )}

          {messages?.map((msg) => {
            const isAuthor = msg.type === 'AUTHOR_MESSAGE';
            return (
              <MessageBubble
                key={msg.id}
                senderName={isAuthor ? 'You' : msg.sender.displayName || 'BookLeaf Support'}
                senderRole={isAuthor ? 'AUTHOR' : 'ADMIN'}
                body={msg.body}
                createdAt={msg.createdAt}
              />
            );
          })}

          <div ref={threadEndRef} />
        </CardContent>

        {/* Floating Scroll to Bottom Indicator */}
        {showScrollBottomPill && (
          <div className="sticky bottom-4 flex justify-center pointer-events-none">
            <Button
              size="sm"
              variant="secondary"
              onClick={scrollToBottom}
              className="pointer-events-auto shadow-md gap-1 text-xs rounded-full border border-border"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              New replies below
            </Button>
          </div>
        )}

        {/* Follow-up Reply Box / Closed State Banner */}
        <CardFooter className="p-4 border-t border-border/80 bg-muted/15 flex flex-col items-stretch">
          {isClosed ? (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-stone-100 text-stone-800 border border-stone-200 text-xs w-full dark:bg-stone-900/40 dark:border-stone-800 dark:text-stone-300">
              <Info className="h-4 w-4 shrink-0 text-stone-600 dark:text-stone-400" />
              <span>This ticket is closed and no longer accepting follow-up responses. If you have further questions, please submit a new query.</span>
            </div>
          ) : (
            <form onSubmit={handleSendReply} className="space-y-3 w-full">
              {isResolved && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>This ticket is marked as resolved. Sending a follow-up reply will automatically reopen it for support attention.</span>
                </div>
              )}

              {errorMessage && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <Textarea
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Type your response or follow-up question here..."
                className="min-h-[100px] resize-y bg-background border-border/80 focus-visible:ring-primary/20 text-sm"
                maxLength={5000}
                aria-label="Follow-up message"
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {replyText.length} / 5000 characters
                </span>

                <Button
                  type="submit"
                  size="sm"
                  disabled={!replyText.trim() || sendFollowUpMutation.isPending}
                  className="gap-1.5 shadow-xs"
                >
                  {sendFollowUpMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Send Reply
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
export default TicketDetailPage;
