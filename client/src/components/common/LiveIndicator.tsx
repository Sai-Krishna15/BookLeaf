import { useSocket } from '@/app/providers/SocketProvider';
import { cn } from '@/lib/utils';

export function LiveIndicator({ className }: { className?: string }) {
  const { status } = useSocket();

  const isConnected = status === 'connected';
  const isReconnecting = status === 'connecting' || status === 'reconnecting';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
        isConnected &&
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
        isReconnecting &&
          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
        !isConnected &&
          !isReconnecting &&
          'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
        className,
      )}
      title={`Realtime status: ${status}`}
    >
      <span className="relative flex h-2 w-2">
        {isConnected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        {isReconnecting && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        )}
        <span
          className={cn(
            'relative inline-flex rounded-full h-2 w-2',
            isConnected && 'bg-emerald-500',
            isReconnecting && 'bg-amber-500',
            !isConnected && !isReconnecting && 'bg-slate-400',
          )}
        />
      </span>
      <span>
        {isConnected ? 'Live' : isReconnecting ? 'Reconnecting...' : 'Offline'}
      </span>
    </div>
  );
}
