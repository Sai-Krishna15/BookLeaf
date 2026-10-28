import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
  isActive?: boolean;
  variant?: 'default' | 'warning' | 'danger';
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  isActive = false,
  variant = 'default',
  onClick,
  className,
}: StatCardProps) {
  const isClickable = !!onClick;

  const variantStyles = {
    default: {
      card: isActive
        ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
        : 'hover:border-border/80 hover:bg-muted/30',
      iconBg: 'bg-primary/10 text-primary',
      value: 'text-foreground',
    },
    warning: {
      card: isActive
        ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20 dark:bg-amber-950/20'
        : 'border-amber-200 dark:border-amber-800/60 bg-amber-50/10 dark:bg-amber-950/10 hover:bg-amber-50/20',
      iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
      value: 'text-amber-600 dark:text-amber-400 font-bold',
    },
    danger: {
      card: isActive
        ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/20 dark:bg-red-950/20'
        : 'border-red-200 dark:border-red-800/60 bg-red-50/10 dark:bg-red-950/10 hover:bg-red-50/20',
      iconBg: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
      value: 'text-red-600 dark:text-red-400 font-bold',
    },
  }[variant];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'transition-all duration-150 select-none border shadow-sm',
        isClickable && 'cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        variantStyles.card,
        className,
      )}
    >
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className={cn('text-2xl font-bold tracking-tight', variantStyles.value)}>
              {value}
            </span>
          </div>
          {sublabel && (
            <p className="text-[11px] text-muted-foreground truncate">{sublabel}</p>
          )}
        </div>

        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', variantStyles.iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}
