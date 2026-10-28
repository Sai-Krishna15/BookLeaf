import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addMonths,
  subMonths,
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export interface CalendarProps {
  selected?: Date | { from?: Date; to?: Date };
  onSelect?: (date: Date) => void;
  className?: string;
}

export function Calendar({ selected, onSelect, className }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(new Date());

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const selectedDate = selected instanceof Date ? selected : selected?.from;

  return (
    <div className={cn('p-3', className)}>
      <div className="flex items-center justify-between pb-2">
        <button
          type="button"
          onClick={prevMonth}
          className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-7 w-7')}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{format(currentMonth, 'MMMM yyyy')}</span>
        <button
          type="button"
          onClick={nextMonth}
          className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-7 w-7')}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground pb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => onSelect?.(day)}
              className={cn(
                'h-8 w-8 text-sm p-0 rounded-md font-normal transition-colors flex items-center justify-center',
                !isCurrentMonth && 'text-muted-foreground opacity-40',
                isToday(day) && !isSelected && 'border border-primary font-bold text-primary',
                isSelected && 'bg-primary text-primary-foreground font-semibold',
                !isSelected && isCurrentMonth && 'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
