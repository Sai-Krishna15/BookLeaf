import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { CategoryBadge } from '@/components/common/CategoryBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { TableSkeleton } from '@/components/common/Skeletons';
import { PriorityStripe } from './PriorityStripe';
import { SourceMarker } from './SourceMarker';
import { AgeCell } from './AgeCell';
import { OverdueIndicator } from './OverdueIndicator';
import { RowActionsMenu } from './RowActionsMenu';
import type { AdminTicket } from '../types';
import { formatTicketNumber } from '@/lib/formatters';
import { Inbox, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QueueTableProps {
  tickets: AdminTicket[];
  isLoading: boolean;
  isFetching?: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  className?: string;
}

export function QueueTable({
  tickets,
  isLoading,
  isFetching = false,
  hasActiveFilters,
  onClearFilters,
  className,
}: QueueTableProps) {
  const navigate = useNavigate();

  const columns = React.useMemo<ColumnDef<AdminTicket>[]>(
    () => [
      {
        id: 'stripe',
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center pl-1">
            <PriorityStripe priority={row.original.priority} />
          </div>
        ),
      },
      {
        accessorKey: 'ticketNumber',
        header: 'Ticket',
        cell: ({ row }) => {
          const t = row.original;
          const isUnassigned = !t.assignedToId;
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                className={cn(
                  'font-mono text-xs text-foreground',
                  isUnassigned ? 'font-bold text-primary underline-offset-2' : 'font-medium',
                )}
              >
                {formatTicketNumber(t.ticketNumber)}
              </span>
              <OverdueIndicator isOverdue={t.isOverdue} />
              {t.needsManualTriage && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">
                        <Badge
                          variant="destructive"
                          className="text-[9px] px-1 py-0 h-4 font-bold uppercase tracking-wider"
                        >
                          Triage
                        </Badge>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      AI triage failed or low confidence. Manual review required.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'subject',
        header: 'Subject & Description',
        cell: ({ row }) => {
          const t = row.original;
          return (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="max-w-[280px] xl:max-w-[360px] cursor-pointer">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {t.subject}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {t.description}
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-md text-xs space-y-1">
                  <p className="font-semibold">{t.subject}</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{t.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        id: 'author',
        header: 'Author',
        cell: ({ row }) => (
          <div className="text-xs max-w-[120px] truncate">
            <span className="font-medium text-foreground block truncate">
              {row.original.author.name}
            </span>
            <span className="text-[10px] text-muted-foreground block truncate">
              {row.original.author.email}
            </span>
          </div>
        ),
      },
      {
        id: 'book',
        header: 'Book / Scope',
        cell: ({ row }) => (
          <div className="text-xs max-w-[130px] truncate">
            {row.original.book ? (
              <span className="font-medium text-foreground block truncate" title={row.original.book.title}>
                {row.original.book.title}
              </span>
            ) : (
              <span className="text-muted-foreground text-[11px]">General / Account Level</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="flex items-center gap-1">
              <CategoryBadge category={t.category} />
              <SourceMarker source={t.categorySource} />
            </div>
          );
        },
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="flex items-center gap-1">
              <PriorityBadge priority={t.priority} />
              <SourceMarker source={t.prioritySource} />
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'assignee',
        header: 'Assignee',
        cell: ({ row }) => {
          const assignee = row.original.assignedTo;
          return (
            <span
              className={cn(
                'text-xs block max-w-[110px] truncate',
                assignee ? 'font-medium text-foreground' : 'text-muted-foreground italic',
              )}
            >
              {assignee ? assignee.name : 'Unassigned'}
            </span>
          );
        },
      },
      {
        id: 'age',
        header: 'Age',
        cell: ({ row }) => (
          <AgeCell
            createdAt={row.original.createdAt}
            resolvedAt={row.original.resolvedAt}
          />
        ),
      },
      {
        id: 'actions',
        header: () => null,
        cell: ({ row }) => <RowActionsMenu ticket={row.original} />,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: tickets,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  const handleRowClick = (ticketId: string) => {
    navigate(`/admin/tickets/${ticketId}`);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, ticketId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(`/admin/tickets/${ticketId}`);
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card shadow-sm overflow-hidden relative',
        className,
      )}
      role="region"
      aria-label="Admin Ticket Queue Table"
    >
      {/* Subtle top progress bar when background fetching */}
      {isFetching && !isLoading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary animate-pulse z-10" />
      )}

      {isLoading ? (
        <div className="p-6">
          <TableSkeleton rows={8} cols={7} />
        </div>
      ) : tickets.length === 0 ? (
        <div className="py-12">
          {hasActiveFilters ? (
            <EmptyState
              icon={Search}
              title="No Matching Tickets"
              description="No tickets match the selected filters or search query."
              action={
                <Button variant="outline" size="sm" onClick={onClearFilters}>
                  Clear Filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="Ticket Queue is Clear"
              description="There are currently no tickets in the BookLeaf queue."
            />
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="text-xs font-semibold text-muted-foreground py-3 h-auto"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => {
                const ticket = row.original;
                return (
                  <TableRow
                    key={row.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => handleRowClick(ticket.id)}
                    onKeyDown={(e) => handleRowKeyDown(e, ticket.id)}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border-b border-border/60',
                      ticket.isOverdue && 'bg-red-50/30 dark:bg-red-950/20 hover:bg-red-50/50 dark:hover:bg-red-950/30',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3 px-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
