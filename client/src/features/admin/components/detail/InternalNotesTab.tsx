import * as React from 'react';
import { Lock, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAddNote } from '../../hooks/useAdminDetail';
import type { AdminTicket } from '../../types';

interface InternalNotesTabProps {
  ticket: AdminTicket;
}

export function InternalNotesTab({ ticket }: InternalNotesTabProps) {
  const ticketId = ticket.id;
  const storageKey = `bookleaf_note_${ticketId}`;

  const addNoteMutation = useAddNote(ticketId);
  const [noteText, setNoteText] = React.useState<string>(() => {
    return sessionStorage.getItem(storageKey) || '';
  });

  // Save draft note in sessionStorage
  React.useEffect(() => {
    if (noteText) {
      sessionStorage.setItem(storageKey, noteText);
    } else {
      sessionStorage.removeItem(storageKey);
    }
  }, [noteText, storageKey]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const trimmed = noteText.trim();
    if (!trimmed || addNoteMutation.isPending) return;

    await addNoteMutation.mutateAsync({ body: trimmed });
    setNoteText('');
    sessionStorage.removeItem(storageKey);
  };

  return (
    <div className="space-y-4">
      {/* Privacy Notice Banner */}
      <div className="p-3 rounded-xl bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/20 flex items-center gap-2.5 text-xs shadow-xs">
        <Lock className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="flex-1 leading-relaxed">
          <span className="font-semibold text-foreground">Staff-only notes:</span> These notes are private to the BookLeaf operations team and will never be seen by the author.
        </div>
      </div>

      {/* Note Composer Textarea */}
      <div className="space-y-2">
        <div className="relative">
          <Textarea
            placeholder="Add an internal note or observation for staff colleagues..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={addNoteMutation.isPending}
            maxLength={5000}
            className="min-h-[140px] text-sm pr-16 resize-y border-amber-300/80 dark:border-amber-800/80 focus-visible:ring-2 focus-visible:ring-amber-500/30 bg-amber-500/[0.03] shadow-xs leading-relaxed"
            aria-label="Staff internal note composer"
          />
          <span
            className={`absolute right-3 bottom-2.5 text-[10px] pointer-events-none font-mono ${
              noteText.length > 4800 ? 'text-destructive font-bold' : 'text-muted-foreground'
            }`}
          >
            {noteText.length} / 5000
          </span>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/80 font-mono text-[10px] text-foreground">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/80 font-mono text-[10px] text-foreground">Enter</kbd> to add note
          </span>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!noteText.trim() || addNoteMutation.isPending}
            className="gap-2 text-xs h-8 bg-amber-700 hover:bg-amber-800 text-white font-medium shadow-xs"
          >
            {addNoteMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Adding Note...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Add Internal Note
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
