import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AdminUser } from '../types';

interface ActiveFilterChipsProps {
  status?: string;
  category?: string;
  priority?: string;
  assignedTo?: string;
  needsManualTriage?: string | boolean;
  from?: string;
  to?: string;
  q?: string;
  sort?: string;
  admins?: AdminUser[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
  className?: string;
}

export function ActiveFilterChips({
  status,
  category,
  priority,
  assignedTo,
  needsManualTriage,
  from,
  to,
  q,
  sort,
  admins = [],
  onRemove,
  onClearAll,
  className,
}: ActiveFilterChipsProps) {
  const chips: Array<{ key: string; label: string }> = [];

  if (status) {
    chips.push({ key: 'status', label: `Status: ${status.replace('_', ' ')}` });
  }

  if (category) {
    const formattedCat = category
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    chips.push({ key: 'category', label: `Category: ${formattedCat}` });
  }

  if (priority) {
    chips.push({ key: 'priority', label: `Priority: ${priority}` });
  }

  if (assignedTo) {
    let assigneeLabel = assignedTo;
    if (assignedTo === 'me') assigneeLabel = 'Assigned to Me';
    else if (assignedTo === 'unassigned') assigneeLabel = 'Unassigned';
    else {
      const found = admins.find((a) => a.id === assignedTo);
      if (found) assigneeLabel = `Assignee: ${found.name}`;
      else assigneeLabel = `Assignee: ${assignedTo}`;
    }
    chips.push({ key: 'assignedTo', label: assigneeLabel });
  }

  if (needsManualTriage === 'true' || needsManualTriage === true) {
    chips.push({ key: 'needsManualTriage', label: 'Needs Triage' });
  }

  if (from || to) {
    const dateLabel = from && to ? `${from} to ${to}` : from ? `From ${from}` : `Until ${to}`;
    chips.push({ key: 'date', label: `Date: ${dateLabel}` });
  }

  if (q) {
    chips.push({ key: 'q', label: `Search: "${q}"` });
  }

  if (sort && sort !== 'urgency') {
    chips.push({
      key: 'sort',
      label: `Sort: ${sort.charAt(0).toUpperCase() + sort.slice(1)}`,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 py-1 ${className || ''}`}>
      <span className="text-xs text-muted-foreground mr-1">Active filters:</span>
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 pl-2.5 pr-1.5 py-1 text-xs font-normal bg-muted border border-border text-foreground hover:bg-muted/80"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={() => onRemove(chip.key)}
            className="hover:bg-foreground/10 rounded p-0.5 transition-colors"
            aria-label={`Remove filter ${chip.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        Clear filters
      </Button>
    </div>
  );
}
