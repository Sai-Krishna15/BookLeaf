import * as React from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import type { AdminUser } from '../types';

interface FilterBarProps {
  status?: string;
  category?: string;
  priority?: string;
  assignedTo?: string;
  needsManualTriage?: string | boolean;
  from?: string;
  to?: string;
  q?: string;
  sort?: string;
  limit?: number;
  admins: AdminUser[];
  onFilterChange: (updates: Record<string, string | undefined>) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function FilterBar({
  status = 'ALL',
  category = 'ALL',
  priority = 'ALL',
  assignedTo = 'ALL',
  needsManualTriage = false,
  from = '',
  to = '',
  q = '',
  sort = 'urgency',
  limit = 20,
  admins = [],
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
}: FilterBarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState(q);
  const debouncedQ = useDebounce(searchInput, 400);

  const [fromDate, setFromDate] = React.useState(from);
  const [toDate, setToDate] = React.useState(to);
  const [dateError, setDateError] = React.useState<string | null>(null);

  // Sync external search param changes to local input
  React.useEffect(() => {
    setSearchInput(q);
  }, [q]);

  // Sync external date props to local state
  React.useEffect(() => {
    setFromDate(from);
  }, [from]);

  React.useEffect(() => {
    setToDate(to);
  }, [to]);

  // Sync debounced search to parent filter change
  React.useEffect(() => {
    if (debouncedQ !== q) {
      onFilterChange({ q: debouncedQ || undefined });
    }
  }, [debouncedQ, q, onFilterChange]);

  // Calculate active filter count (excluding default search)
  const activeCount = React.useMemo(() => {
    let count = 0;
    if (status && status !== 'ALL') count++;
    if (category && category !== 'ALL') count++;
    if (priority && priority !== 'ALL') count++;
    if (assignedTo && assignedTo !== 'ALL') count++;
    if (sort && sort !== 'urgency') count++;
    if (limit && limit !== 20) count++;
    if (from) count++;
    if (to) count++;
    if (needsManualTriage === 'true' || needsManualTriage === true) count++;
    return count;
  }, [status, category, priority, assignedTo, sort, limit, from, to, needsManualTriage]);

  // Date range validation
  const handleDateChange = (newFrom: string, newTo: string) => {
    setFromDate(newFrom);
    setToDate(newTo);

    if (newFrom && newTo && newFrom > newTo) {
      setDateError('Start date cannot be after end date');
      return;
    }

    setDateError(null);
    onFilterChange({
      from: newFrom || undefined,
      to: newTo || undefined,
    });
  };

  const handleResetFilters = () => {
    onClearFilters();
    setFromDate('');
    setToDate('');
    setDateError(null);
  };

  return (
    <div className="bg-card p-2.5 sm:p-3 rounded-xl border border-border shadow-xs">
      {/* Outside Row: Search Bar (takes main width) + Filter Sidebar Trigger Button */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search subject, text or BL-1003..."
            className="pl-9 h-9 text-xs bg-background border-border/80 focus-visible:ring-1"
            aria-label="Search tickets"
          />
        </div>

        {/* Filter Trigger Button - opens Sheet from left to right */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant={activeCount > 0 ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'h-9 px-3 gap-2 text-xs font-medium shrink-0 shadow-xs transition-colors',
                activeCount > 0
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-card hover:bg-muted/60 text-foreground border-border',
              )}
              aria-label="Open filter sidebar"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeCount > 0 && (
                <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary-foreground/20 text-[10px] font-bold">
                  {activeCount}
                </span>
              )}
            </Button>
          </SheetTrigger>

          <SheetContent
            side="left"
            className="w-[320px] sm:w-[380px] p-0 flex flex-col bg-card border-r border-border shadow-elevated z-50"
          >
            {/* Sheet Header */}
            <SheetHeader className="p-4 sm:p-5 border-b border-border/70 text-left">
              <div className="flex items-center justify-between pr-6">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <SheetTitle className="text-base font-semibold">Filter Tickets</SheetTitle>
                </div>
                {activeCount > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                    {activeCount} active
                  </span>
                )}
              </div>
              <SheetDescription className="text-xs text-muted-foreground mt-1">
                Narrow the ticket operations queue by status, category, priority, assignee, or dates.
              </SheetDescription>
            </SheetHeader>

            {/* Scrollable Filters List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Status</Label>
                <Select
                  value={status}
                  onValueChange={(val) =>
                    onFilterChange({ status: val === 'ALL' ? undefined : val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Category</Label>
                <Select
                  value={category}
                  onValueChange={(val) =>
                    onFilterChange({ category: val === 'ALL' ? undefined : val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Categories</SelectItem>
                    <SelectItem value="ROYALTY_PAYMENTS">Royalty Payments</SelectItem>
                    <SelectItem value="ISBN_METADATA">ISBN & Metadata</SelectItem>
                    <SelectItem value="PRINTING_QUALITY">Printing & Quality</SelectItem>
                    <SelectItem value="DISTRIBUTION_AVAILABILITY">
                      Distribution & Availability
                    </SelectItem>
                    <SelectItem value="BOOK_STATUS_PRODUCTION">
                      Book Status / Production
                    </SelectItem>
                    <SelectItem value="GENERAL_INQUIRY">General / Account Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(val) =>
                    onFilterChange({ priority: val === 'ALL' ? undefined : val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Priorities</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Assignee</Label>
                <Select
                  value={assignedTo}
                  onValueChange={(val) =>
                    onFilterChange({ assignedTo: val === 'ALL' ? undefined : val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Anyone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Anyone</SelectItem>
                    <SelectItem value="me">Assigned to Me</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {admins.map((adm) => (
                      <SelectItem key={adm.id} value={adm.id}>
                        {adm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Order */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Sort Order</Label>
                <Select value={sort} onValueChange={(val) => onFilterChange({ sort: val })}>
                  <SelectTrigger className="h-9 text-xs">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgency">Urgency (Default)</SelectItem>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Page Size / Limit */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Items per page</Label>
                <Select
                  value={String(limit)}
                  onValueChange={(val) => onFilterChange({ limit: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Limit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                    <SelectItem value="100">100 / page</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-medium text-foreground">Created Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">From</span>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => handleDateChange(e.target.value, toDate)}
                      className="h-8 text-[11px] px-2 py-0"
                      aria-label="From date"
                      title="From date"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">To</span>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => handleDateChange(fromDate, e.target.value)}
                      className="h-8 text-[11px] px-2 py-0"
                      aria-label="To date"
                      title="To date"
                    />
                  </div>
                </div>
                {dateError && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive pt-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>{dateError}</span>
                  </div>
                )}
              </div>

              {/* Needs Manual Triage */}
              <div className="pt-2 border-t border-border/60">
                <div className="flex items-center space-x-2.5 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                  <Checkbox
                    id="needsManualTriage"
                    checked={needsManualTriage === 'true' || needsManualTriage === true}
                    onCheckedChange={(checked) =>
                      onFilterChange({ needsManualTriage: checked ? 'true' : undefined })
                    }
                  />
                  <Label
                    htmlFor="needsManualTriage"
                    className="text-xs font-medium cursor-pointer text-foreground select-none flex-1"
                  >
                    Needs manual triage only
                  </Label>
                </div>
              </div>
            </div>

            {/* Sheet Footer */}
            <SheetFooter className="p-4 border-t border-border/70 bg-muted/20 flex flex-row items-center justify-between sm:justify-between gap-2">
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
                >
                  Reset all
                </Button>
              ) : (
                <div />
              )}

              <Button
                type="button"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 px-4 text-xs font-medium"
              >
                Apply & Close
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
