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
          <Button asChild size="sm" className="gap-1.5 shadow-sm">
            <Link to="/tickets/new">
              <Plus className="h-4 w-4" />
              New Support Query
            </Link>
          </Button>
        }
      />

      {/* Filters Toolbar */}
      <Card className="p-4 border-border shadow-sm bg-card">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by subject or description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9 text-xs sm:text-sm"
              aria-label="Search tickets"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Status Filter */}
            <Select value={statusParam} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
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
              <SelectTrigger className="w-[130px] h-9 text-xs">
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
        <Card className="p-6 border-border">
          <TableSkeleton rows={5} cols={5} />
        </Card>
      )}

      {isError && (
        <ErrorState
          title="Failed to load your tickets"
          message="Could not load your ticket queue. Please verify your connection."
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && tickets.length === 0 && (
        <>
          {hasActiveFilters ? (
            <EmptyState
              icon={Search}
              title="No Matching Tickets"
              description="No support queries match your search or status filter."
              action={
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Ticket}
              title="No Support Queries Yet"
              description="You haven't submitted any queries. Need assistance with royalties, ISBNs, or printing?"
              action={
                <Button asChild size="sm">
                  <Link to="/tickets/new">Raise your first query</Link>
                </Button>
              }
            />
          )}
        </>
      )}

      {!isLoading && !isError && tickets.length > 0 && (
        <Card className="border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[120px] font-semibold">Ticket ID</TableHead>
                  <TableHead className="min-w-[240px] font-semibold">Subject</TableHead>
                  <TableHead className="min-w-[180px] font-semibold">Related Book</TableHead>
                  <TableHead className="w-[130px] font-semibold">Status</TableHead>
                  <TableHead className="w-[150px] font-semibold text-right">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => {
                  const unread = isTicketUnread(ticket.id);

                  return (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors group"
                    >
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        <Link
                          to={`/tickets/${ticket.id}`}
                          className="flex items-center gap-1.5 group-hover:text-primary transition-colors"
                        >
                          {unread && (
                            <span
                              className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"
                              title="New response received"
                            />
                          )}
                          <span>{formatTicketNumber(ticket.ticketNumber)}</span>
                        </Link>
                      </TableCell>

                      <TableCell>
                        <Link
                          to={`/tickets/${ticket.id}`}
                          className="block font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1"
                        >
                          {ticket.subject}
                        </Link>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {ticket.description}
                        </p>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {ticket.book ? (
                          <div className="flex items-center gap-1.5 font-medium text-foreground truncate max-w-[200px]">
                            <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{ticket.book.title}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground font-medium">
                            General / Account Level
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={ticket.status as TicketStatus} />
                      </TableCell>

                      <TableCell
                        className="text-right text-xs text-muted-foreground whitespace-nowrap"
                        title={formatDateTime(ticket.updatedAt)}
                      >
                        {relativeTime(ticket.updatedAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {meta && (
            <div className="px-4 border-t border-border">
              <Pagination meta={meta} onPageChange={handlePageChange} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
export default TicketsPage;
