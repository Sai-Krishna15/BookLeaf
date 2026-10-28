import * as React from 'react';
import { Search, ArrowUpDown, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/useDebounce';
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
  const [searchInput, setSearchInput] = React.useState(q);
  const debouncedQ = useDebounce(searchInput, 400);

  const [fromDate, setFromDate] = React.useState(from);
  const [toDate, setToDate] = React.useState(to);
  const [dateError, setDateError] = React.useState<string | null>(null);

  // Sync external search param changes to local input
  React.useEffect(() => {
    setSearchInput(q);
  }, [q]);

  // Sync debounced search to parent filter change
  React.useEffect(() => {
    if (debouncedQ !== q) {
      onFilterChange({ q: debouncedQ || undefined });
    }
  }, [debouncedQ, q, onFilterChange]);

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

  return (
    <div className="space-y-3 bg-card p-4 rounded-xl border border-border shadow-sm">
      {/* Top Row: Search + Status + Sort + Limit */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search */}
        <div className="md:col-span-5 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search subject, text or BL-1003..."
            className="pl-9 h-9 text-xs"
            aria-label="Search tickets"
          />
        </div>

        {/* Status Selector */}
        <div className="md:col-span-3">
          <Select
            value={status}
            onValueChange={(val) => onFilterChange({ status: val === 'ALL' ? undefined : val })}
          >
            <SelectTrigger className="h-9 text-xs">
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
        </div>

        {/* Sort Selector */}
        <div className="md:col-span-2">
          <Select
            value={sort}
            onValueChange={(val) => onFilterChange({ sort: val })}
          >
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

        {/* Page Size Selector */}
        <div className="md:col-span-2">
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
      </div>

      {/* Bottom Row: Category + Priority + Assignee + Date + Needs Triage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center pt-1 border-t border-border/50 text-xs">
        {/* Category */}
        <div className="lg:col-span-3">
          <Select
            value={category}
            onValueChange={(val) => onFilterChange({ category: val === 'ALL' ? undefined : val })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              <SelectItem value="ROYALTY_PAYMENTS">Royalty Payments</SelectItem>
              <SelectItem value="ISBN_METADATA">ISBN & Metadata</SelectItem>
              <SelectItem value="PRINTING_QUALITY">Printing & Quality</SelectItem>
              <SelectItem value="DISTRIBUTION_AVAILABILITY">Distribution & Availability</SelectItem>
              <SelectItem value="BOOK_STATUS_PRODUCTION">Book Status / Production</SelectItem>
              <SelectItem value="GENERAL_INQUIRY">General Inquiry</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div className="lg:col-span-2">
          <Select
            value={priority}
            onValueChange={(val) => onFilterChange({ priority: val === 'ALL' ? undefined : val })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Priority" />
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
        <div className="lg:col-span-3">
          <Select
            value={assignedTo}
            onValueChange={(val) => onFilterChange({ assignedTo: val === 'ALL' ? undefined : val })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Assignee" />
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

        {/* Date Range Inputs */}
        <div className="lg:col-span-2 flex items-center gap-1.5">
          <div className="relative flex-1">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => handleDateChange(e.target.value, toDate)}
              className="h-8 text-[11px] px-2 py-0"
              aria-label="From date"
              title="From date"
            />
          </div>
          <span className="text-muted-foreground text-xs">to</span>
          <div className="relative flex-1">
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

        {/* Needs Triage Toggle & Clear Button */}
        <div className="lg:col-span-2 flex items-center justify-between sm:justify-end gap-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="needsManualTriage"
              checked={needsManualTriage === 'true' || needsManualTriage === true}
              onCheckedChange={(checked) =>
                onFilterChange({ needsManualTriage: checked ? 'true' : undefined })
              }
            />
            <Label
              htmlFor="needsManualTriage"
              className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground select-none"
            >
              Needs triage
            </Label>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {dateError && (
        <div className="flex items-center gap-1.5 text-xs text-destructive pt-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{dateError}</span>
        </div>
      )}
    </div>
  );
}
