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
    <Card className="shadow-sm border-border bg-card">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <User className="h-4 w-4 text-primary" />
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
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border">
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
                      className="h-7 w-7 p-0"
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
                  <div className="space-y-2 pt-1 border-t border-border/50">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded bg-muted/40 border border-border/50">
                        <span className="text-[10px] text-muted-foreground">MRP</span>
                        <div className="font-semibold">{formatINR(book.mrp)}</div>
                      </div>
                      <div className="p-2 rounded bg-muted/40 border border-border/50">
                        <span className="text-[10px] text-muted-foreground">Copies Sold</span>
                        <div className="font-semibold">
                          {book.totalCopiesSold.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 p-2 rounded-md bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Royalty Earned:</span>
                        <span className="font-semibold text-foreground">
                          {formatINR(book.totalRoyaltyEarned)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Royalty Paid:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatINR(book.royaltyPaid)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Royalty Pending:</span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {formatINR(book.royaltyPending)}
                        </span>
                      </div>
                      {book.lastRoyaltyPayoutDate && (
                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
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
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Globe className="h-3 w-3 shrink-0" />
                          <span>Distribution:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {book.availableOn.map((plat: string) => (
                            <span
                              key={plat}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground border border-border"
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
                    <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded border border-border/50">
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
              <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">
                General Query
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
                  <div className="p-2 rounded bg-muted/40 border border-border/50">
                    <span className="text-[10px] text-muted-foreground">Total Books</span>
                    <div className="font-semibold text-foreground">
                      {authorSummary.bookCount}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-muted/40 border border-border/50">
                    <span className="text-[10px] text-muted-foreground">Published</span>
                    <div className="font-semibold text-foreground">
                      {authorSummary.publishedCount}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-md bg-muted/30 border border-border/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Earned:</span>
                    <span className="font-semibold text-foreground">
                      {formatINR(authorSummary.totalEarned)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Paid:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatINR(authorSummary.totalPaid)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Pending:</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {formatINR(authorSummary.totalPending)}
                    </span>
                  </div>
                </div>

                {authorSummary.pendingBelowThreshold && (
                  <div className="flex items-start gap-1.5 p-2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px]">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
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
