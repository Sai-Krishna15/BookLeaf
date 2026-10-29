import * as React from 'react';
import {
  BookOpen,
  User,
  Copy,
  Check,
  Building,
  Globe,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductionStageTracker } from '@/components/common/ProductionStageTracker';
import { useBookFacts, useAuthorBooksSummary } from '../../hooks/useAdminDetail';
import { formatDate, formatINR } from '@/lib/formatters';
import type { AdminTicket } from '../../types';

interface AuthorBookFactsCardProps {
  ticket: AdminTicket;
}

export function AuthorBookFactsCard({ ticket }: AuthorBookFactsCardProps) {
  const [copiedIsbn, setCopiedIsbn] = React.useState(false);

  const {
    data: book,
    isLoading: bookLoading,
    isError: bookError,
  } = useBookFacts(ticket.bookId);

  const {
    data: authorSummary,
    isLoading: summaryLoading,
  } = useAuthorBooksSummary(ticket.bookId ? null : ticket.authorId);

  const handleCopyIsbn = (isbn: string) => {
    navigator.clipboard.writeText(isbn);
    setCopiedIsbn(true);
    toast.success('Copied ISBN to clipboard');
    setTimeout(() => setCopiedIsbn(false), 2000);
  };

  return (
    <Card className="shadow-xs border-border bg-card rounded-xl">
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
          <User className="h-3.5 w-3.5 text-primary" />
          <span>Author & Context Facts</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Author Basics */}
        <div className="space-y-1">
          <div className="text-xs font-semibold text-foreground">
            {ticket.author.name}
          </div>
          <div className="text-xs text-muted-foreground break-all">
            {ticket.author.email}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            ID: {ticket.author.id}
          </div>
        </div>

        <div className="h-px bg-border/60" />

        {/* Book Facts (if ticket has bookId) */}
        {ticket.bookId ? (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span>Book Details</span>
            </div>

            {bookLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : bookError || !book ? (
              <div className="text-xs text-muted-foreground italic">
                Could not load book details for ID: {ticket.bookId}
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="font-medium text-foreground">{book.title}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">
                    Genre: {book.genre || 'General'}
                  </div>
                </div>

                {/* ISBN with Copy Button */}
                {book.isbn && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">ISBN</span>
                      <div className="font-mono text-xs font-semibold text-foreground">
                        {book.isbn}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyIsbn(book.isbn)}
                      className="h-7 w-7 p-0 hover:bg-card"
                      title="Copy ISBN"
                    >
                      {copiedIsbn ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                )}

                {/* Published vs In Production */}
                {book.isPublished ? (
                  <div className="space-y-2.5 pt-1 border-t border-border/50">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-muted/40">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">MRP</span>
                        <div className="font-semibold text-foreground font-mono">{formatINR(book.mrp)}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/40">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Copies Sold</span>
                        <div className="font-semibold text-foreground font-mono">
                          {book.totalCopiesSold.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 p-2.5 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Royalty Earned:</span>
                        <span className="font-semibold text-foreground font-mono">
                          {formatINR(book.totalRoyaltyEarned)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Royalty Paid:</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono">
                          {formatINR(book.royaltyPaid)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Royalty Pending:</span>
                        <span className="font-semibold text-amber-700 dark:text-amber-400 font-mono">
                          {formatINR(book.royaltyPending)}
                        </span>
                      </div>
                      {book.lastRoyaltyPayoutDate && (
                        <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-[11px]">
                          <span className="text-muted-foreground">Last Payout:</span>
                          <span className="text-foreground">
                            {formatDate(book.lastRoyaltyPayoutDate)}
                          </span>
                        </div>
                      )}
                    </div>

                    {book.printPartner && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Building className="h-3.5 w-3.5 shrink-0" />
                        <span>Print Partner: {book.printPartner}</span>
                      </div>
                    )}

                    {book.availableOn && book.availableOn.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Globe className="h-3 w-3 shrink-0" />
                          <span>Distribution:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {book.availableOn.map((plat: string) => (
                            <span
                              key={plat}
                              className="px-2 py-0.5 rounded text-[10px] bg-muted/80 text-muted-foreground font-medium"
                            >
                              {plat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pt-1 border-t border-border/50">
                    <div className="text-[11px] font-semibold text-primary">
                      Production In Progress
                    </div>
                    <ProductionStageTracker
                      stages={book.productionStage?.stages}
                      currentStage={book.productionStage?.currentStage}
                      currentStageIndex={book.productionStage?.currentStageIndex}
                      rawStatus={book.status}
                    />
                    <div className="text-[11px] text-muted-foreground bg-muted/50 p-2.5 rounded-lg">
                      No royalties are earned or tracked during the production phase.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* General Inquiry (No book selected) */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Author Portfolio Summary
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60 font-medium">
                General / Account Level
              </span>
            </div>

            {summaryLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : authorSummary ? (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-muted/40">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Books</span>
                    <div className="font-semibold text-foreground font-mono">
                      {authorSummary.bookCount}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Published</span>
                    <div className="font-semibold text-foreground font-mono">
                      {authorSummary.publishedCount}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-muted/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Earned:</span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatINR(authorSummary.totalEarned)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Paid:</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono">
                      {formatINR(authorSummary.totalPaid)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Pending:</span>
                    <span className="font-semibold text-amber-700 dark:text-amber-400 font-mono">
                      {formatINR(authorSummary.totalPending)}
                    </span>
                  </div>
                </div>

                {authorSummary.pendingBelowThreshold && (
                  <div className="flex items-start gap-1.5 p-2.5 rounded-xl bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/20 text-xs shadow-xs">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
                    <span className="leading-relaxed">
                      Pending royalties are below the ₹1,000 threshold and will roll over to the next payout window.
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
