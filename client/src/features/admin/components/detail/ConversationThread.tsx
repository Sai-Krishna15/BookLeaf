import * as React from 'react';
import {
  User,
  ShieldCheck,
  Lock,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/formatters';
import { getFileIcon, formatFileSize } from '@/components/common/FileDropzone';
import type { AdminTicket } from '../../types';
import type { TicketMessage } from '@/features/tickets/types';
import { cn } from '@/lib/utils';

interface ConversationThreadProps {
  ticket: AdminTicket;
  messages: TicketMessage[] | undefined;
  isLoading: boolean;
  hasNewAuthorMessage?: boolean;
  onClearNewAuthorMessage?: () => void;
}

export function ConversationThread({
  ticket,
  messages,
  isLoading,
  hasNewAuthorMessage = false,
  onClearNewAuthorMessage,
}: ConversationThreadProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const threadEndRef = React.useRef<HTMLDivElement>(null);
  const [showScrollBottomPill, setShowScrollBottomPill] = React.useState(false);

  const scrollToBottom = React.useCallback(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottomPill(false);
    onClearNewAuthorMessage?.();
  }, [onClearNewAuthorMessage]);

  // Initial scroll to bottom when thread loads
  React.useEffect(() => {
    if (!isLoading && messages) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isLoading, messages]);

  // If a new author message arrives, scroll or show pill
  React.useEffect(() => {
    if (hasNewAuthorMessage) {
      if (!showScrollBottomPill) {
        scrollToBottom();
      }
    }
  }, [hasNewAuthorMessage, showScrollBottomPill, scrollToBottom]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
    setShowScrollBottomPill(!isNearBottom);
  };

  return (
    <div className="relative">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="space-y-4 max-h-[600px] overflow-y-auto pr-1.5 scroll-smooth"
      >
        {/* 1. Original Author Query */}
        <div className="flex gap-3 py-1">
          <Avatar className="h-8 w-8 mt-1 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-1.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                {ticket.author.name}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                Original Query
              </span>
              <span className="text-[11px] text-muted-foreground ml-auto">
                {formatDateTime(ticket.createdAt)}
              </span>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card text-foreground text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words">
              {ticket.description}
            </div>

            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ticket.attachments.map((att, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border bg-background text-foreground"
                  >
                    {getFileIcon(att.mimeType)}
                    <span className="font-medium truncate max-w-[200px]">{att.name}</span>
                    {att.size > 0 && (
                      <span className="text-muted-foreground text-[11px]">
                        ({formatFileSize(att.size)})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. Loading Skeleton */}
        {isLoading && (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-20 w-3/4 ml-auto" />
            <Skeleton className="h-24 w-3/4" />
          </div>
        )}

        {/* 3. Messages List */}
        {messages &&
          messages.map((msg) => {
            const isNote = msg.type === 'INTERNAL_NOTE';
            const isAuthor = msg.type === 'AUTHOR_MESSAGE';
            const isAdmin = msg.type === 'ADMIN_REPLY';

            if (isNote) {
              return (
                <div
                  key={msg.id}
                  className="flex gap-3 py-1 bg-amber-500/[0.06] dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-500/20 shadow-xs"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100 text-xs font-semibold">
                      <Lock className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                        {msg.sender.displayName || 'Staff Member'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                        <Lock className="h-2.5 w-2.5" />
                        Internal note — not visible to the author
                      </span>
                      <span className="text-[11px] text-amber-800/80 dark:text-amber-400 ml-auto font-mono">
                        {formatDateTime(msg.createdAt)}
                      </span>
                    </div>

                    <div className="text-sm leading-relaxed text-amber-950 dark:text-amber-100 whitespace-pre-wrap break-words">
                      {msg.body}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex gap-3 py-1">
                <Avatar className="h-8 w-8 mt-1 shrink-0">
                  <AvatarFallback
                    className={cn(
                      'text-xs font-semibold',
                      isAuthor
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-primary text-primary-foreground border border-primary/40',
                    )}
                  >
                    {isAuthor ? <User className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-1.5 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {isAuthor ? msg.sender.displayName || ticket.author.name : msg.sender.displayName || 'BookLeaf Support'}
                    </span>
                    {isAdmin && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        Staff Response
                      </span>
                    )}
                    {msg.aiAssisted && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/5 text-primary border border-primary/20">
                        <Sparkles className="h-2.5 w-2.5 text-primary" />
                        AI assisted
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto font-mono">
                      {formatDateTime(msg.createdAt)}
                    </span>
                  </div>

                  <div
                    className={cn(
                      'p-4 rounded-xl border text-sm leading-relaxed shadow-xs whitespace-pre-wrap break-words',
                      isAuthor
                        ? 'bg-card border-border text-foreground'
                        : 'bg-primary/[0.03] border-primary/25 text-foreground',
                    )}
                  >
                    {msg.body}
                  </div>
                </div>
              </div>
            );
          })}

        <div ref={threadEndRef} />
      </div>

      {/* Floating Pill for New Messages / Scroll to Bottom */}
      {(showScrollBottomPill || hasNewAuthorMessage) && (
        <div className="sticky bottom-2 flex justify-center pointer-events-none mt-2">
          <Button
            size="sm"
            variant={hasNewAuthorMessage ? 'default' : 'secondary'}
            onClick={scrollToBottom}
            className="pointer-events-auto gap-1.5 shadow-md border text-xs h-7 px-3 backdrop-blur-sm"
          >
            {hasNewAuthorMessage ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                </span>
                <span>New author message</span>
              </>
            ) : (
              <span>Latest messages</span>
            )}
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
