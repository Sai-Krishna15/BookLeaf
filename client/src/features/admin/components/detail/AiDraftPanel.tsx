import * as React from 'react';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useRegenerateDraft } from '../../hooks/useAdminDetail';
import type { CannedSnippet, DraftResponse, TicketCategory } from '../../types';
import { ApiError } from '@/lib/api';

const DEFAULT_SNIPPETS: Record<string, CannedSnippet[]> = {
  ROYALTY_PAYMENTS: [
    {
      id: 'royalty-calc',
      title: 'Royalty Calculation',
      template: 'Royalties are calculated as (MRP - Print Cost) * Royalty %, settled quarterly.',
    },
    {
      id: 'payout-schedule',
      title: 'Payout Schedule',
      template: 'Payouts occur within 45 days following each calendar quarter close for balances >= ₹1,000.',
    },
    {
      id: 'threshold-info',
      title: '₹1,000 Threshold',
      template: 'Balances below ₹1,000 are carried forward to the subsequent quarterly payout cycle.',
    },
  ],
  ISBN_METADATA: [
    {
      id: 'isbn-assignment',
      title: 'ISBN Assignment',
      template: 'ISBNs are assigned uniquely per edition and cannot be transferred or reused once issued.',
    },
    {
      id: 'metadata-update',
      title: 'Metadata Sync',
      template: 'Metadata changes typically take 2-4 business days to reflect across retail distribution networks.',
    },
  ],
  PRINTING_QUALITY: [
    {
      id: 'quality-spec',
      title: 'Paper Specs',
      template: 'We print using 70-80 GSM natural shade paper with standard laminated covers.',
    },
    {
      id: 'reprint-policy',
      title: 'Defect Replacement',
      template: 'If you received a defective copy, please share photos of the spine and pages for a free reprint.',
    },
  ],
  DISTRIBUTION_AVAILABILITY: [
    {
      id: 'channel-sync',
      title: 'Retail Channels',
      template: 'Your book is listed on Amazon, Flipkart, and the BookLeaf store. Feeds sync every 48 hours.',
    },
    {
      id: 'out-of-stock',
      title: 'POD Stock',
      template: 'Since we print on demand, your title is always available to print upon order receipt.',
    },
  ],
  BOOK_STATUS_PRODUCTION: [
    {
      id: 'prod-timeline',
      title: 'Production Timeline',
      template: 'Standard production takes 14-21 business days spanning editing, interior formatting, and cover design.',
    },
    {
      id: 'proof-approval',
      title: 'Proof Review',
      template: 'Once formatting is complete, you will receive a digital proof to approve before printing.',
    },
  ],
  GENERAL_INQUIRY: [
    {
      id: 'account-help',
      title: 'Dashboard Help',
      template: 'You can manage your author profile and bank details directly in your Author Portal.',
    },
    {
      id: 'support-hours',
      title: 'Support Hours',
      template: 'Our author support team is available Monday to Friday from 9:30 AM to 6:30 PM IST.',
    },
  ],
};

interface AiDraftPanelProps {
  ticketId: string;
  category: TicketCategory | null;
  draftResponse: DraftResponse | undefined;
  isLoading: boolean;
  isStale: boolean;
  hasUserEdits: boolean;
  hasPendingAiArrival: boolean;
  onApplyDraft: (draftBody: string) => void;
  onInsertSnippet: (snippetText: string) => void;
  disabled?: boolean;
}

export function AiDraftPanel({
  ticketId,
  category,
  draftResponse,
  isLoading,
  isStale,
  hasUserEdits,
  hasPendingAiArrival,
  onApplyDraft,
  onInsertSnippet,
  disabled = false,
}: AiDraftPanelProps) {
  const regenerateMutation = useRegenerateDraft(ticketId);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = React.useState(false);
  const [rateLimitSeconds, setRateLimitSeconds] = React.useState<number | null>(null);

  // Rate limit countdown handler
  React.useEffect(() => {
    if (rateLimitSeconds === null || rateLimitSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateLimitSeconds((prev) => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  const draft = draftResponse?.draft;
  const isUnavailable = draftResponse?.status === 'unavailable' || (!isLoading && !draft);
  const snippets: CannedSnippet[] =
    draftResponse?.snippets && draftResponse.snippets.length > 0
      ? draftResponse.snippets
      : (category && DEFAULT_SNIPPETS[category]) || DEFAULT_SNIPPETS.GENERAL_INQUIRY || [];

  const handleRegenerateClick = () => {
    if (hasUserEdits) {
      setConfirmRegenerateOpen(true);
    } else {
      executeRegenerate();
    }
  };

  const executeRegenerate = async () => {
    try {
      await regenerateMutation.mutateAsync();
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setRateLimitSeconds(60);
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. Header Row: Badges, Metadata, and Regenerate button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
              <Sparkles className="h-3.5 w-3.5 text-purple-600 animate-spin" />
              <span>Generating AI draft...</span>
            </div>
          ) : draft ? (
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  hasUserEdits
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                {hasUserEdits ? 'Edited' : 'AI Draft'}
              </span>

              {/* Model & Metadata Tooltip */}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="p-1 rounded text-muted-foreground hover:text-foreground cursor-help"
                      aria-label="Draft info"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs space-y-1">
                    <div>Provider: {draft.provider || 'gemini'}</div>
                    <div>Model: {draft.model || 'gemini-2.5-pro'}</div>
                    <div>Draft ID: {draft.id.slice(0, 8)}...</div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">Manual Composer</span>
          )}
        </div>

        {/* Regenerate Draft Button */}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRegenerateClick}
            disabled={disabled || regenerateMutation.isPending || isLoading || rateLimitSeconds !== null}
            className="h-7 text-xs gap-1.5"
          >
            <RefreshCw
              className={`h-3 w-3 ${regenerateMutation.isPending ? 'animate-spin' : ''}`}
            />
            {rateLimitSeconds !== null
              ? `Retry in ${rateLimitSeconds}s`
              : regenerateMutation.isPending
                ? 'Regenerating...'
                : 'Regenerate Draft'}
          </Button>
        </div>
      </div>

      {/* 2. Pending AI Draft Arrival Banner (When user was already typing) */}
      {hasPendingAiArrival && draft && (
        <div className="flex items-center justify-between p-2.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 text-xs">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>AI draft has arrived. Click to inspect or insert into composer.</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onApplyDraft(draft.body)}
            className="h-6 px-2 text-xs bg-white dark:bg-purple-900/60"
          >
            Insert AI Draft
          </Button>
        </div>
      )}

      {/* 3. Stale Draft Banner (Author sent a newer message) */}
      {(isStale || draft?.stale) && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            The author has replied since this draft was generated. Regenerating the draft is recommended.
          </span>
        </div>
      )}

      {/* 4. AI Warnings Callout (e.g. low confidence, policy clarification needed) */}
      {draft?.warnings && draft.warnings.length > 0 && (
        <div className="p-2.5 rounded-md bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>AI Policy Verification Notes:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1">
            {draft.warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. Unavailable Fallback Banner + Quick-Insert Snippets */}
      {isUnavailable && (
        <div className="p-3 rounded-md bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-0.5 flex-1">
              <span className="font-semibold">AI draft is currently unavailable</span>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                {draftResponse?.reason ||
                  'The AI drafting service was bypassed, rate limited, or failed. You can compose a manual response or use the canned policy snippets below.'}
              </p>
            </div>
          </div>

          {/* Quick-Insert Snippets Chips */}
          <div className="pt-1 border-t border-amber-200/80 dark:border-amber-800/60">
            <div className="flex items-center gap-1 text-[11px] font-medium text-amber-900 dark:text-amber-200 mb-1.5">
              <FileText className="h-3 w-3" />
              <span>Quick-insert policy snippets:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {snippets.map((snip) => (
                <button
                  key={snip.id}
                  type="button"
                  onClick={() => onInsertSnippet(snip.template)}
                  disabled={disabled}
                  className="px-2 py-1 rounded bg-white dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/70 text-[11px] transition-colors flex items-center gap-1"
                >
                  <span>+</span>
                  <span className="font-medium">{snip.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog before regenerating draft when edits exist */}
      <ConfirmDialog
        open={confirmRegenerateOpen}
        onOpenChange={setConfirmRegenerateOpen}
        title="Regenerate AI Draft?"
        description="You have modified the draft in the composer. Regenerating will replace your current edits with a freshly generated response."
        confirmText="Yes, Regenerate"
        cancelText="Keep My Edits"
        onConfirm={executeRegenerate}
        isDestructive={true}
      />
    </div>
  );
}
