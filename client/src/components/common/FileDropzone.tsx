import * as React from 'react';
import { UploadCloud, File, FileText, Image, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AttachmentMeta } from '@/features/tickets/types';

interface FileDropzoneProps {
  files: AttachmentMeta[];
  onFilesChange: (files: AttachmentMeta[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number; // 10MB default
  className?: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return <Image className="h-4 w-4 text-blue-500" />;
  }
  if (mimeType.includes('pdf') || mimeType.includes('text')) {
    return <FileText className="h-4 w-4 text-amber-500" />;
  }
  return <File className="h-4 w-4 text-slate-500" />;
}

export function FileDropzone({
  files,
  onFilesChange,
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024,
  className,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const processFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const newFiles: AttachmentMeta[] = [];
    const availableSlots = maxFiles - files.length;

    if (fileList.length > availableSlots) {
      setError(`You can attach a maximum of ${maxFiles} files.`);
      return;
    }

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i]!;
      if (f.size > maxSizeBytes) {
        setError(`File "${f.name}" exceeds the 10 MB limit.`);
        return;
      }
      newFiles.push({
        name: f.name,
        size: f.size,
        mimeType: f.type || 'application/octet-stream',
      });
    }

    onFilesChange([...files, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const removeFile = (index: number) => {
    const updated = [...files];
    updated.splice(index, 1);
    onFilesChange(updated);
    setError(null);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Upload attachments dropzone"
        className={cn(
          'flex flex-col items-center justify-center p-5 rounded-lg border-2 border-dashed transition-colors cursor-pointer text-center outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40 bg-card/50',
          files.length >= maxFiles && 'pointer-events-none opacity-50',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            processFiles(e.target.files);
            e.target.value = '';
          }}
          disabled={files.length >= maxFiles}
        />
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
          <UploadCloud className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-foreground">
          Drop reference files here or <span className="text-primary underline">browse</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Max {maxFiles} files, up to 10 MB each (images, PDFs, documents)
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground italic">
        File upload isn&apos;t enabled in this version; your file names will be noted on the ticket.
      </p>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="flex items-center justify-between p-2 rounded-md border border-border bg-card text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                {getFileIcon(file.mimeType)}
                <span className="font-medium text-foreground truncate">{file.name}</span>
                <span className="text-muted-foreground shrink-0">({formatFileSize(file.size)})</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(idx);
                }}
                aria-label={`Remove file ${file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
