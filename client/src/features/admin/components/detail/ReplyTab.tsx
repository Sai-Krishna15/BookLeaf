import * as React from 'react';
import { Send, Loader2, RotateCcw, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { AiDraftPanel } from './AiDraftPanel';
import { useDraft, useReply } from '../../hooks/useAdminDetail';
import { usePatchTicket } from '../../hooks/useAdmin';
import type { AdminTicket } from '../../types';
import { ApiError } from '@/lib/api';

interface ReplyTabProps {
  ticket: AdminTicket;
  isStale?: boolean;
}

export function ReplyTab({ ticket, isStale = false }: ReplyTabProps) {
  const ticketId = ticket.id;
  const storageKey = `bookleaf_draft_${ticketId}`;

  const { data: draftResponse, isLoading: draftLoading } = useDraft(ticketId);
  const replyMutation = useReply(ticketId);
  const patchTicketMutation = usePatchTicket();

  const [replyText, setReplyText] = React.useState<string>(() => {
    return sessionStorage.getItem(storageKey) || '';
  });
  const [initialDraftApplied, setInitialDraftApplied] = React.useState(false);
  const [hasPendingAiArrival, setHasPendingAiArrival] = React.useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = React.useState(false);
  const [closedConflictError, setClosedConflictError] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const isClosed = ticket.status === 'CLOSED';
  const draft = draftResponse?.draft;

  // Unsent text persistence in sessionStorage
  React.useEffect(() => {
    if (replyText) {
      sessionStorage.setItem(storageKey, replyText);
    } else {
      sessionStorage.removeItem(storageKey);
    }
  }, [replyText, storageKey]);

  // Warn on page unload if unsent draft text exists
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (replyText.trim().length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [replyText]);

  // Handle auto-prefill when draft loads
  React.useEffect(() => {
    if (draft && !initialDraftApplied) {
      setInitialDraftApplied(true);
      // Only prefill if the composer was empty
      if (!replyText.trim()) {
        setReplyText(draft.body);
      } else if (replyText.trim() !== draft.body.trim()) {
        // User typed text before draft arrived: DO NOT overwrite!
        setHasPendingAiArrival(true);
      }
    }
  }, [draft, initialDraftApplied, replyText]);

  const hasUserEdits = Boolean(draft && replyText.trim() !== draft.body.trim());

  const handleApplyDraft = (draftBody: string) => {
    setReplyText(draftBody);
    setHasPendingAiArrival(false);
    toast.info('Applied AI draft to composer');
  };

  const handleInsertSnippet = (snippetText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setReplyText((prev) => (prev ? `${prev}\n\n${snippetText}` : snippetText));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = replyText;

    const before = current.substring(0, start);
    const after = current.substring(end);
    const updated = before ? `${before}\n\n${snippetText}${after ? `\n\n${after}` : ''}` : `${snippetText}${after}`;

    setReplyText(updated);
    toast.success('Inserted policy snippet');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to open confirmation dialog
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (replyText.trim() && !replyMutation.isPending && !isClosed) {
        setSendConfirmOpen(true);
      }
    }
  };

  const handleConfirmSend = async () => {
    const trimmed = replyText.trim();
    if (!trimmed) return;

    try {
      await replyMutation.mutateAsync({
        body: trimmed,
        draftId: draft?.id,
      });

      // Clear text and storage on success
      setReplyText('');
      sessionStorage.removeItem(storageKey);
      setHasPendingAiArrival(false);
      setClosedConflictError(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setClosedConflictError(true);
      }
    }
  };

  const handleReopenTicket = () => {
    patchTicketMutation.mutate(
      {
        id: ticket.id,
        payload: { status: 'IN_PROGRESS' },
      },
      {
        onSuccess: () => {
          setClosedConflictError(false);
          toast.success('Ticket reopened');
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      {/* AI Draft Panel controls and states */}
      <AiDraftPanel
        ticketId={ticketId}
        category={ticket.category}
        draftResponse={draftResponse}
        isLoading={draftLoading}
        isStale={isStale}
        hasUserEdits={hasUserEdits}
        hasPendingAiArrival={hasPendingAiArrival}
        onApplyDraft={handleApplyDraft}
        onInsertSnippet={handleInsertSnippet}
        disabled={isClosed || replyMutation.isPending}
      />

      {/* Closed state alerts */}
      {isClosed && (
        <div className="p-3 rounded-xl bg-muted/60 text-muted-foreground border border-border flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>This ticket is closed. Reopen the ticket to send a reply.</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleReopenTicket}
            disabled={patchTicketMutation.isPending}
            className="h-7 text-xs gap-1 shadow-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Reopen Ticket
          </Button>
        </div>
      )}

      {/* 409 Closed conflict banner */}
      {closedConflictError && (
        <div className="p-3 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>This ticket is currently closed. Reopen it to send your reply.</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={handleReopenTicket}
            disabled={patchTicketMutation.isPending}
            className="h-7 text-xs gap-1 shadow-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Reopen Ticket
          </Button>
        </div>
      )}

      {/* Composer Textarea */}
      <div className="space-y-2">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder={
              isClosed
                ? 'Ticket is closed.'
                : 'Compose your official reply to the author. AI draft is pre-filled above and fully editable...'
            }
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isClosed || replyMutation.isPending}
            maxLength={5000}
            className="min-h-[160px] text-sm pr-16 resize-y bg-card border-border focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary shadow-xs leading-relaxed"
            aria-label="Author reply composer"
          />
          <span
            className={`absolute right-3 bottom-2.5 text-[10px] pointer-events-none font-mono ${
              replyText.length > 4800 ? 'text-destructive font-bold' : 'text-muted-foreground'
            }`}
          >
            {replyText.length} / 5000
          </span>
        </div>

        {/* Action bar below composer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/80 font-mono text-[10px] text-foreground">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/80 font-mono text-[10px] text-foreground">Enter</kbd> to send
          </span>

          <Button
            type="button"
            onClick={() => setSendConfirmOpen(true)}
            disabled={!replyText.trim() || replyMutation.isPending || isClosed}
            className="gap-2 text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs font-medium"
          >
            {replyMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending Reply...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Send Reply
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Send Reply Confirmation Dialog */}
      <ConfirmDialog
        open={sendConfirmOpen}
        onOpenChange={setSendConfirmOpen}
        title={`Send Reply to ${ticket.author.name}?`}
        description="This message will be emailed to the author and posted to their support portal. Please review your response before sending."
        confirmText="Send Reply"
        cancelText="Review Draft"
        onConfirm={handleConfirmSend}
      />
    </div>
  );
}
