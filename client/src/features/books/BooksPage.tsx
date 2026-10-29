import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  DollarSign,
  Layers,
  Calendar,
  Building2,
  Globe,
  Copy,
  Check,
  PlusCircle,
  Clock,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { MoneyStat } from '@/components/common/MoneyStat';
import { ProductionStageTracker } from '@/components/common/ProductionStageTracker';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/common/Skeletons';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { useBooks, useBooksSummary } from './hooks/useBooks';
import { formatDate, formatINR } from '@/lib/formatters';
import type { Book } from './types';

function BookCard({ book }: { book: Book }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyIsbn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!book.isbn) return;
    navigator.clipboard.writeText(book.isbn);
    setCopied(true);
    toast.success(`Copied ISBN: ${book.isbn}`);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPublished = book.isPublished;

  return (
    <Card className="flex flex-col h-full overflow-hidden border border-border/80 bg-card shadow-xs hover:shadow-subtle transition-all duration-150">
      <CardHeader className="p-5 pb-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <span
            className={
              isPublished
                ? 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-xs bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                : 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-xs bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800'
            }
          >
            <span
              className={
                isPublished
                  ? 'h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-600 dark:bg-emerald-400'
                  : 'h-1.5 w-1.5 rounded-full shrink-0 bg-sky-600 dark:bg-sky-400'
              }
              aria-hidden="true"
            />
            <span>{isPublished ? 'Published' : 'In Production'}</span>
          </span>

          {book.genre && (
            <span className="text-xs text-muted-foreground font-medium truncate max-w-[150px]">
              {book.genre}
            </span>
          )}
        </div>

        <h3 className="font-bold text-lg leading-snug tracking-tight text-foreground line-clamp-2">
          {book.title}
        </h3>

        {/* ISBN Row */}
        <div className="flex items-center gap-2 pt-0.5">
          <span className="text-xs text-muted-foreground font-medium">ISBN:</span>
          {book.isbn ? (
            <div className="inline-flex items-center gap-1.5 bg-muted/70 px-2 py-0.5 rounded font-mono text-xs text-foreground border border-border/50 shadow-xs">
              <span>{book.isbn}</span>
              <button
                type="button"
                onClick={handleCopyIsbn}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                title="Copy ISBN"
                aria-label={`Copy ISBN ${book.isbn}`}
              >
                {copied ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground font-mono">Pending assignment</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-2 flex-1 space-y-4 text-xs">
        {/* Meta Info */}
        <div className="grid grid-cols-2 gap-3 py-2.5 border-y border-border/60">
          <div>
            <span className="text-muted-foreground block text-[11px] font-medium">Publication Date</span>
            <span className="font-medium text-foreground flex items-center gap-1.5 mt-0.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {formatDate(book.publicationDate)}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block text-[11px] font-medium">Copies Sold</span>
            <span className="font-semibold text-foreground text-sm mt-0.5 block tabular-nums">
              {isPublished ? book.totalCopiesSold.toLocaleString('en-IN') : '—'}
            </span>
          </div>
        </div>

        {/* In-Production Stage Tracker */}
        {!isPublished && (
          <div className="pt-1">
            <ProductionStageTracker
              stages={book.productionStage?.stages}
              currentStage={book.productionStage?.currentStage}
              currentStageIndex={book.productionStage?.currentStageIndex}
              rawStatus={book.status}
            />
          </div>
        )}

        {/* Published Financial Metrics */}
        {isPublished && (
          <div className="space-y-3 pt-1">
            {/* Financial Summary Strip without nested border */}
            <div className="grid grid-cols-3 gap-2 bg-muted/50 p-2.5 rounded-lg text-center">
              <div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">MRP</span>
                <span className="font-semibold text-foreground text-xs tabular-nums mt-0.5 block">{formatINR(book.mrp)}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Per Copy</span>
                <span className="font-semibold text-foreground text-xs tabular-nums mt-0.5 block">{formatINR(book.authorRoyaltyPerCopy)}</span>
              </div>
              <div>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">Total Earned</span>
                <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300 tabular-nums mt-0.5 block">
                  {formatINR(book.totalRoyaltyEarned)}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs px-1">
              <span className="text-muted-foreground">Royalty Paid:</span>
              <span className="font-medium text-foreground tabular-nums">{formatINR(book.royaltyPaid)}</span>
            </div>

            <div className="flex justify-between items-center text-xs px-1">
              <span className="text-muted-foreground">Royalty Pending:</span>
              <span className="font-bold text-foreground text-sm tabular-nums">{formatINR(book.royaltyPending)}</span>
            </div>

            <div className="flex justify-between items-center text-xs px-1 border-t border-border/40 pt-2">
              <span className="text-muted-foreground">Last Payout:</span>
              <span className="font-medium text-foreground">
                {book.lastRoyaltyPayoutDate ? formatDate(book.lastRoyaltyPayoutDate) : 'No payout yet'}
              </span>
            </div>

            {/* Special Callouts for Published Books */}
            {book.neverPaid && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-sky-50/70 border border-sky-200 text-sky-950 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-200 text-[11px] leading-relaxed">
                <Clock className="h-4 w-4 shrink-0 mt-0.5 text-sky-700 dark:text-sky-400" />
                <div>
                  <p className="font-semibold text-sky-900 dark:text-sky-200">First Payout Cycle</p>
                  <p className="mt-0.5 opacity-90">
                    No payout has been made yet. Royalties are calculated quarterly and paid within 45 days of quarter end.
                    {book.payoutWindows?.nextQuarterPayoutDeadline && (
                      <span className="block mt-0.5 font-medium">
                        Next deadline: {formatDate(book.payoutWindows.nextQuarterPayoutDeadline)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {book.belowPayoutThreshold && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200 text-[11px] leading-relaxed">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-200">Below ₹1,000 Minimum Payout</p>
                  <p className="mt-0.5 opacity-90">
                    Pending royalties ({formatINR(book.royaltyPending)}) are below the ₹1,000 threshold and will roll over to the next payout window.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Partners & Platforms */}
        <div className="space-y-1.5 pt-2 border-t border-border/60">
          {book.printPartner && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span>Print Partner: {book.printPartner}</span>
            </div>
          )}

          {book.availableOn && book.availableOn.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-[11px] text-muted-foreground mr-1">Available on:</span>
              {book.availableOn.map((plat) => (
                <span
                  key={plat}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-muted text-foreground border border-border/80 shadow-xs"
                >
                  {plat}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 border-t border-border/40 mt-auto">
        <Button
          variant="outline"
          size="sm"
          asChild
          className="w-full gap-1.5 text-xs font-medium hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
        >
          <Link to={`/tickets/new?bookId=${book.id}`}>
            <PlusCircle className="h-3.5 w-3.5" />
            Raise a query
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function BooksPage() {
  const { data: booksData, isLoading: booksLoading, isError: booksError, refetch: refetchBooks } = useBooks({
    limit: 100,
  });
  const { data: summary, isLoading: summaryLoading } = useBooksSummary();

  const isLoading = booksLoading || summaryLoading;
  const books = booksData?.data || [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Books"
        description="View your published titles, production tracking, and royalty metrics."
        actions={
          <Button asChild size="sm" className="gap-1.5 shadow-xs">
            <Link to="/tickets/new">
              <HelpCircle className="h-4 w-4" />
              Submit Query
            </Link>
          </Button>
        }
      />

      {/* Summary Strip */}
      {summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MoneyStat
              label="Total Earned"
              amount={summary.totalEarned}
              description={`Across ${summary.publishedCount} published books`}
              icon={DollarSign}
              variant="success"
            />
            <MoneyStat
              label="Total Paid"
              amount={summary.totalPaid}
              description="Disbursed to date"
              icon={Building2}
              variant="default"
            />
            <MoneyStat
              label="Total Pending"
              amount={summary.totalPending}
              description="Awaiting upcoming payout window"
              icon={Clock}
              variant={summary.pendingBelowThreshold ? 'warning' : 'default'}
              belowThreshold={summary.pendingBelowThreshold}
            />
            <div className="rounded-xl border border-border/80 bg-card p-5 shadow-xs hover:shadow-subtle transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Book Portfolio
                </p>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/15">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {summary.bookCount} {summary.bookCount === 1 ? 'Book' : 'Books'}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summary.publishedCount} published · {summary.inProductionCount} in production
                </p>
              </div>
            </div>
          </div>

          {summary.pendingBelowThreshold && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <span className="leading-relaxed">
                Your total pending royalties ({formatINR(summary.totalPending)}) are below the ₹1,000 minimum payout threshold and will roll over to the next quarter.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {isLoading && <CardSkeleton cards={3} />}

      {booksError && (
        <ErrorState
          title="Failed to load your books"
          message="Could not retrieve your book catalog. Please check your network and try again."
          onRetry={() => refetchBooks()}
        />
      )}

      {!isLoading && !booksError && books.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No Books Found"
          description="You do not have any published or in-production books linked to your author profile."
          action={
            <Button asChild size="sm">
              <Link to="/tickets/new">Contact Support</Link>
            </Button>
          }
        />
      )}

      {!isLoading && !booksError && books.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
export default BooksPage;
