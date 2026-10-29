import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatINR } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface MoneyStatProps {
  label: string;
  amount: number | null | undefined;
  description?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'muted';
  belowThreshold?: boolean;
  className?: string;
}

export function MoneyStat({
  label,
  amount,
  description,
  icon: Icon,
  variant = 'default',
  belowThreshold = false,
  className,
}: MoneyStatProps) {
  return (
    <Card className={cn('relative overflow-hidden border border-border/80 bg-card shadow-xs transition-shadow hover:shadow-subtle', className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          {Icon && (
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                variant === 'success' && 'bg-emerald-50 text-emerald-800 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
                variant === 'warning' && 'bg-amber-50 text-amber-800 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
                variant === 'default' && 'bg-primary/10 text-primary border border-primary/15',
                variant === 'muted' && 'bg-muted text-muted-foreground border border-border/60',
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {formatINR(amount)}
          </span>
          {belowThreshold && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shadow-xs dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
              Rolls over
            </span>
          )}
        </div>

        {description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
