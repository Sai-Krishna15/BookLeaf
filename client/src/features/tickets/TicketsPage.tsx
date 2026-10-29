import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Ticket,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  BookOpen,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { TableSkeleton } from '@/components/common/Skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { useTickets } from './hooks/useTickets';
import { useUnreadTickets } from './hooks/useAuthorTicketRealtime';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime, formatTicketNumber, relativeTime } from '@/lib/formatters';
import type { TicketStatus } from './types';

export function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isTicketUnread } = useUnreadTickets();

  // URL search params
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const statusParam = searchParams.get('status') || 'ALL';
  const sortParam = (searchParams.get('sort') as 'newest' | 'oldest') || 'newest';
  const qParam = searchParams.get('q') || '';

  const [searchInput, setSearchInput] = React.useState(qParam);
  const debouncedQuery = useDebounce(searchInput, 400);

  // Sync debounced query back to search params
  React.useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedQuery) {
          next.set('q', debouncedQuery);
        } else {
          next.delete('q');
        }
        next.set('page', '1');
        return next;
      },
      { replace: true },
    );
  }, [debouncedQuery, setSearchParams]);

  const queryParams = {
    page: pageParam,
    limit: 15,
    status: statusParam === 'ALL' ? undefined : statusParam,
    q: qParam || undefined,
    sort: sortParam,
  };

  const { data, isLoading, isError, refetch } = useTickets(queryParams);

  const tickets = data?.data || [];
  const meta = data?.meta;

  const handleStatusChange = (val: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (val === 'ALL') {
          next.delete('status');
        } else {
          next.set('status', val);
        }
        next.set('page', '1');
        return next;
      },
      { replace: true },
    );
  };

  const handleSortChange = (val: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('sort', val);
        next.set('page', '1');
        return next;
      },
      { replace: true },
    );
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(newPage));
        return next;
      },
      { replace: true },
    );
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  };

  const hasActiveFilters = statusParam !== 'ALL' || !!qParam;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Support Tickets"
        description="Track your inquiries, follow-ups, and responses from the BookLeaf support team."
        actions={
          <Button asChild size="sm" className="gap-1.5 shadow-xs">
            <Link to="/tickets/new">
              <Plus className="h-4 w-4" />
              New Support Query
            </Link>
          </Button>
        }
      />

      {/* Filters Toolbar */}
      <Card className="p-4 border-border/80 shadow-xs bg-card">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by subject or description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9 text-xs sm:text-sm bg-background border-border/80"
              aria-label="Search tickets"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Status Filter */}
            <Select value={statusParam} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px] h-9 text-xs border-border/80 bg-background">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Selector */}
            <Select value={sortParam} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[130px] h-9 text-xs border-border/80 bg-background">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Main Tickets List / Table */}
      {isLoading && (
        <Card className="p-6 border-border/80 shadow-xs bg-card">
          <TableSkeleton rows={5} cols={5} />
        </Card>
      )}

      {isError && (
        <ErrorState
          title="Failed to load your tickets"
          message="Could not retrieve your support queries. Please check your connection and try again."
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && tickets.length === 0 && (
        <EmptyState
          icon={Ticket}
          title={hasActiveFilters ? 'No Matching Tickets' : 'No Support Queries Yet'}
          description={
            hasActiveFilters
              ? 'No tickets match the selected filters or search terms.'
              : 'Have a question about your royalty, book distribution, or metadata? Raise your first query.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/tickets/new">Create Ticket</Link>
              </Button>
            )
          }
        />
      )}

      {!isLoading && !isError && tickets.length > 0 && (
        <div className="space-y-4">
          <Card className="border border-border/80 shadow-xs overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/40 border-b border-border/80">
                    <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ticket ID</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject</TableHead>
                    <TableHead className="w-[200px] text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                      Related Book
                    </TableHead>
                    <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="w-[150px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Last Updated
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((t) => {
                    const isUnread = isTicketUnread(t.id);
                    return (
                      <TableRow
                        key={t.id}
                        className="group hover:bg-muted/40 transition-colors border-b border-border/60"
                      >
                        <TableCell className="font-mono text-xs font-semibold text-foreground">
                          <Link
                            to={`/tickets/${t.id}`}
                            className="hover:underline flex items-center gap-1.5"
                          >
                            {isUnread && (
                              <span
                                className="h-2 w-2 rounded-full bg-primary shrink-0 ring-2 ring-background"
                                title="New response received"
                                aria-label="Unread ticket"
                              />
                            )}
                            <span>{formatTicketNumber(t.ticketNumber)}</span>
                          </Link>
                        </TableCell>

                        <TableCell>
                          <Link to={`/tickets/${t.id}`} className="block space-y-0.5">
                            <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                              {t.subject}
                            </span>
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {t.description}
                            </span>
                          </Link>
                        </TableCell>

                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {t.book ? (
                            <div className="flex items-center gap-1.5 truncate">
                              <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate max-w-[180px] font-medium text-foreground">
                                {t.book.title}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">General / Account Level</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <StatusBadge status={t.status as TicketStatus} />
                        </TableCell>

                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          <span title={formatDateTime(t.updatedAt)}>
                            {relativeTime(t.updatedAt)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Pagination */}
          {meta && (
            <Pagination
              meta={meta}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      )}
    </div>
  );
}
export default TicketsPage;
