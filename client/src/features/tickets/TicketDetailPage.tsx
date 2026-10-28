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
        <Card className="p-6 space-y-4">
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
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-muted-foreground">
          <Link to="/tickets">
            <ArrowLeft className="h-4 w-4" />
            Back to Tickets
          </Link>
        </Button>

        <span className="text-xs font-mono text-muted-foreground">
          Ticket {formatTicketNumber(ticket.ticketNumber)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{ticket.subject}</h1>
          <StatusBadge status={ticket.status as TicketStatus} className="text-sm px-3 py-1" />
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

          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>Created {formatDateTime(ticket.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Status Explanation Banner */}
      <TicketStatusNote status={ticket.status as TicketStatus} />

      {/* Conversation Thread Container */}
      <Card className="border border-border shadow-sm overflow-hidden flex flex-col">
        <CardHeader className="p-4 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Conversation Thread
          </CardTitle>
          <span className="text-xs text-muted-foreground">
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
              <Skeleton className="h-20 w-3/4" />
            </div>
          )}

          {messages &&
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                senderName={msg.sender?.displayName || 'BookLeaf Support'}
                senderRole={msg.type === 'AUTHOR_MESSAGE' ? 'AUTHOR' : 'ADMIN'}
                body={msg.body}
                createdAt={msg.createdAt}
              />
            ))}

          <div ref={threadEndRef} />

          {/* Floating New Response Pill */}
          {showScrollBottomPill && (
            <div className="sticky bottom-2 flex justify-center pointer-events-none">
              <Button
                size="sm"
                variant="secondary"
                onClick={scrollToBottom}
                className="pointer-events-auto gap-1.5 shadow-md border text-xs h-7 px-3 bg-background/95 backdrop-blur-sm"
              >
                <span>Latest messages</span>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>

        {/* 3. Follow-up Reply Composer */}
        <CardFooter className="p-4 border-t border-border bg-card flex flex-col gap-3">
          {isClosed ? (
            <div className="w-full p-3 rounded-lg bg-muted text-center text-xs text-muted-foreground">
              This ticket is closed and no longer accepting follow-up responses. If you have a new question, please{' '}
              <Link to="/tickets/new" className="text-primary underline font-medium">
                submit a new query
              </Link>
              .
            </div>
          ) : (
            <form onSubmit={handleSendReply} className="w-full space-y-3">
              {isResolved && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md border border-amber-200 dark:border-amber-800">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    This ticket is currently marked resolved. Sending a follow-up reply will automatically reopen it for staff review.
                  </span>
                </div>
              )}

              {errorMessage && (
                <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="relative">
                <Textarea
                  placeholder="Type your response to the support team..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-[100px] text-sm pr-16 resize-y"
                  maxLength={5000}
                  disabled={sendFollowUpMutation.isPending}
                  aria-label="Follow-up message"
                />
                <span className="absolute right-3 bottom-2.5 text-[10px] text-muted-foreground pointer-events-none">
                  {replyText.length} / 5000
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[11px] text-muted-foreground">
                  Our team typically reviews follow-up replies within 24 to 48 hours.
                </span>

                <Button
                  type="submit"
                  disabled={!replyText.trim() || sendFollowUpMutation.isPending}
                  className="gap-2"
                >
                  {sendFollowUpMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
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
