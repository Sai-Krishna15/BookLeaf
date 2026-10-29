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
        'flex gap-3.5 py-1.5',
        className,
      )}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8 mt-1 shrink-0">
        <AvatarFallback
          className={cn(
            'text-xs font-semibold shadow-xs',
            isAuthor
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'bg-primary text-primary-foreground border border-primary',
          )}
        >
          {isAuthor ? <User className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Message Content Container */}
      <div className="flex-1 space-y-1.5 max-w-3xl">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground">
            {isAuthor ? senderName : 'BookLeaf Support'}
          </span>
          {isOriginalQuery && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/70 shadow-xs">
              Original Query
            </span>
          )}
          {!isAuthor && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shadow-xs">
              Staff Response
            </span>
          )}
          <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
            {formatDateTime(createdAt)}
          </span>
        </div>

        {/* Bubble */}
        <div
          className={cn(
            'p-4 rounded-xl border text-sm leading-relaxed shadow-xs whitespace-pre-wrap break-words',
            isAuthor
              ? 'bg-card border-border/80 text-foreground'
              : 'bg-primary/[0.03] border-primary/25 text-foreground ring-1 ring-primary/10',
          )}
        >
          {body}
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border/80 bg-background text-foreground shadow-xs"
              >
                {getFileIcon(att.mimeType)}
                <span className="font-medium truncate max-w-[200px]">{att.name}</span>
                {att.size > 0 && (
                  <span className="text-muted-foreground text-[11px] tabular-nums">
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
