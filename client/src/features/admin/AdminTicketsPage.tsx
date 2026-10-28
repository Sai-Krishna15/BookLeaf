import { useSearchParams } from 'react-router-dom';
import {
  Inbox,
  PlayCircle,
  UserX,
  ClockAlert,
  AlertTriangle,
  Timer,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatCard } from './components/StatCard';
import { FilterBar } from './components/FilterBar';
import { ActiveFilterChips } from './components/ActiveFilterChips';
import { QueueTable } from './components/QueueTable';
import {
  useAdminStats,
  useAdminTickets,
  useAdmins,
} from './hooks/useAdmin';
import { useNewTicketsOffPage } from './hooks/useAdminTicketRealtime';
import { formatHours } from '@/lib/formatters';
import type { AdminQueueFilters, Priority, TicketCategory, TicketStatus } from './types';

export function AdminTicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL params
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const limitParam = parseInt(searchParams.get('limit') || '20', 10);
  const statusParam = searchParams.get('status') || undefined;
  const categoryParam = searchParams.get('category') || undefined;
  const priorityParam = searchParams.get('priority') || undefined;
  const assignedToParam = searchParams.get('assignedTo') || undefined;
  const needsTriageParam = searchParams.get('needsManualTriage') || undefined;
  const fromParam = searchParams.get('from') || undefined;
  const toParam = searchParams.get('to') || undefined;
  const qParam = searchParams.get('q') || undefined;
  const sortParam = (searchParams.get('sort') as 'urgency' | 'newest' | 'oldest') || 'urgency';

  // Construct query object
  const filters: AdminQueueFilters = {
    page: pageParam,
    limit: limitParam,
    status: statusParam as TicketStatus | undefined,
    category: categoryParam as TicketCategory | undefined,
    priority: priorityParam as Priority | undefined,
    assignedTo: assignedToParam,
    needsManualTriage:
      needsTriageParam === 'true'
        ? 'true'
        : needsTriageParam === 'false'
          ? 'false'
          : undefined,
    from: fromParam,
    to: toParam,
    q: qParam,
    sort: sortParam,
  };

  // Queries
  const {
    data: queueData,
    isLoading: isQueueLoading,
    isFetching: isQueueFetching,
    isError: isQueueError,
    refetch: refetchQueue,
  } = useAdminTickets(filters);

  const {
    data: stats,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = useAdminStats();

  const { data: admins = [] } = useAdmins();

  const { newTicketsCount, resetCount } = useNewTicketsOffPage();

  const tickets = queueData?.data || [];
  const meta = queueData?.meta;

  const hasActiveFilters = Boolean(
    statusParam ||
      categoryParam ||
      priorityParam ||
      assignedToParam ||
      needsTriageParam ||
      fromParam ||
      toParam ||
      qParam ||
      (sortParam && sortParam !== 'urgency'),
  );

  // Update filters in URL
  const handleFilterChange = (updates: Record<string, string | undefined>) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined || value === '') {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
        // Always reset to page 1 on filter changes
        next.set('page', '1');
        return next;
      },
      { replace: true },
    );
  };

  const handleRemoveSingleFilter = (key: string) => {
    if (key === 'date') {
      handleFilterChange({ from: undefined, to: undefined });
    } else {
      handleFilterChange({ [key]: undefined });
    }
  };

  const handleClearFilters = () => {
    setSearchParams({}, { replace: true });
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

  // Stat Card click toggles
  const handleStatCardClick = (filterKey: string, filterValue: string) => {
    const currentVal = searchParams.get(filterKey);
    if (currentVal === filterValue) {
      handleFilterChange({ [filterKey]: undefined });
    } else {
      handleFilterChange({ [filterKey]: filterValue });
    }
  };

  // Reset to page 1 from live update pill
  const handleJumpToNewTickets = () => {
    resetCount();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', '1');
        next.set('sort', 'urgency');
        return next;
      },
      { replace: true },
    );
    refetchQueue();
  };

  const handleRefresh = () => {
    refetchQueue();
    refetchStats();
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Ticket Operations Queue"
        description="Unified author inquiry triaging, SLA tracking, AI categorization, and assignment workspace."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-1.5 text-xs h-9"
            title="Refresh queue and metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isQueueFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Dashboard Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {isStatsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Open"
              value={stats?.byStatus?.OPEN ?? 0}
              sublabel="Pending response"
              icon={Inbox}
              isActive={statusParam === 'OPEN'}
              onClick={() => handleStatCardClick('status', 'OPEN')}
            />
            <StatCard
              label="In Progress"
              value={stats?.byStatus?.IN_PROGRESS ?? 0}
              sublabel="Under investigation"
              icon={PlayCircle}
              isActive={statusParam === 'IN_PROGRESS'}
              onClick={() => handleStatCardClick('status', 'IN_PROGRESS')}
            />
            <StatCard
              label="Unassigned"
              value={stats?.unassigned ?? 0}
              sublabel="Needs owner"
              icon={UserX}
              isActive={assignedToParam === 'unassigned'}
              onClick={() => handleStatCardClick('assignedTo', 'unassigned')}
            />
            <StatCard
              label="Overdue"
              value={stats?.overdue ?? 0}
              sublabel="SLA breach risk"
              icon={ClockAlert}
              variant={(stats?.overdue ?? 0) > 0 ? 'danger' : 'default'}
              isActive={statusParam === 'OPEN' && sortParam === 'urgency'}
              onClick={() => handleStatCardClick('status', 'OPEN')}
            />
            <StatCard
              label="Needs Triage"
              value={stats?.needsManualTriage ?? 0}
              sublabel="AI fallback"
              icon={AlertTriangle}
              variant={(stats?.needsManualTriage ?? 0) > 0 ? 'warning' : 'default'}
              isActive={needsTriageParam === 'true'}
              onClick={() => handleStatCardClick('needsManualTriage', 'true')}
            />
            <StatCard
              label="Avg First Reply"
              value={formatHours(stats?.avgFirstResponseHours)}
              sublabel="Target < 24h"
              icon={Timer}
            />
          </>
        )}
      </div>

      {/* Filter Bar */}
      <FilterBar
        status={statusParam || 'ALL'}
        category={categoryParam || 'ALL'}
        priority={priorityParam || 'ALL'}
        assignedTo={assignedToParam || 'ALL'}
        needsManualTriage={needsTriageParam}
        from={fromParam || ''}
        to={toParam || ''}
        q={qParam || ''}
        sort={sortParam}
        limit={limitParam}
        admins={admins}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <ActiveFilterChips
          status={statusParam}
          category={categoryParam}
          priority={priorityParam}
          assignedTo={assignedToParam}
          needsManualTriage={needsTriageParam}
          from={fromParam}
          to={toParam}
          q={qParam}
          sort={sortParam}
          admins={admins}
          onRemove={handleRemoveSingleFilter}
          onClearAll={handleClearFilters}
        />
      )}

      {/* Live Updates Notification Pill (Off-Page 1) */}
      {newTicketsCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex justify-center"
        >
          <Button
            size="sm"
            onClick={handleJumpToNewTickets}
            className="shadow-md gap-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-4 py-1.5 h-auto transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {newTicketsCount} new ticket{newTicketsCount > 1 ? 's' : ''} received · Jump to top
            </span>
          </Button>
        </div>
      )}

      {/* Main Queue Table */}
      {isQueueError ? (
        <ErrorState
          title="Failed to load ticket queue"
          message="Could not load tickets. Please check your network connection and retry."
          onRetry={handleRefresh}
        />
      ) : (
        <div className="space-y-4">
          <QueueTable
            tickets={tickets}
            isLoading={isQueueLoading}
            isFetching={isQueueFetching}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
          />

          {/* Pagination */}
          {meta && meta.total > 0 && (
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
export default AdminTicketsPage;
