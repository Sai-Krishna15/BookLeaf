import { User, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDateTime } from '@/lib/formatters';
import { getFileIcon, formatFileSize } from '@/components/common/FileDropzone';
import type { AttachmentMeta } from '@/features/tickets/types';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  senderName: string;
  senderRole: 'AUTHOR' | 'ADMIN';
  body: string;
  createdAt: string;
  attachments?: AttachmentMeta[];
  isOriginalQuery?: boolean;
  className?: string;
}

export function MessageBubble({
  senderName,
  senderRole,
  body,
  createdAt,
  attachments = [],
  isOriginalQuery = false,
  className,
}: MessageBubbleProps) {
  const isAuthor = senderRole === 'AUTHOR';

  return (
    <div
      className={cn(
        'flex gap-3 py-2',
        isAuthor ? 'flex-row' : 'flex-row',
        className,
      )}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8 mt-1 shrink-0">
        <AvatarFallback
          className={cn(
            'text-xs font-semibold',
            isAuthor
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border border-slate-700',
          )}
        >
          {isAuthor ? <User className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Message Content Container */}
      <div className="flex-1 space-y-1.5 max-w-3xl">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {isAuthor ? senderName : 'BookLeaf Support'}
          </span>
          {isOriginalQuery && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              Original Query
            </span>
          )}
          {!isAuthor && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              Staff Response
            </span>
          )}
          <span className="text-[11px] text-muted-foreground ml-auto">
            {formatDateTime(createdAt)}
          </span>
        </div>

        {/* Bubble */}
        <div
          className={cn(
            'p-4 rounded-xl border text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words',
            isAuthor
              ? 'bg-card border-border text-foreground'
              : 'bg-slate-50 dark:bg-slate-900/60 border-primary/20 text-foreground ring-1 ring-primary/10',
          )}
        >
          {body}
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border bg-background text-foreground"
              >
                {getFileIcon(att.mimeType)}
                <span className="font-medium truncate max-w-[200px]">{att.name}</span>
                {att.size > 0 && (
                  <span className="text-muted-foreground text-[11px]">
                    ({formatFileSize(att.size)})
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
