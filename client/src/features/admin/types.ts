import type {
  AttachmentMeta,
  FieldSource,
  Priority,
  TicketCategory,
  TicketMessage,
  TicketStatus,
  AiStatus,
} from '@/features/tickets/types';

export type {
  AttachmentMeta,
  FieldSource,
  Priority,
  TicketCategory,
  TicketMessage,
  TicketStatus,
  AiStatus,
};

export interface AdminUser {
  id: string;
  name: string;
  email: string;
}

export interface AdminTicket {
  id: string;
  ticketNumber: string;
  ticketNumberRaw?: number;
  authorId: string;
  bookId: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  category: TicketCategory | null;
  categorySource: FieldSource | null;
  priority: Priority;
  prioritySource: FieldSource | null;
  aiStatus: AiStatus;
  aiReasoning: string | null;
  aiError: string | null;
  needsManualTriage: boolean;
  assignedToId: string | null;
  assignedTo: {
    id: string;
    name: string;
  } | null;
  attachments?: AttachmentMeta[];
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  ageHours?: number;
  isOverdue: boolean;
  messageCount: number;
  author: {
    id: string;
    name: string;
    email: string;
  };
  book: {
    id: string;
    title: string;
    isbn?: string | null;
    status?: string;
  } | null;
  messages?: TicketMessage[];
}

export interface AdminStats {
  total: number;
  byStatus: {
    OPEN: number;
    IN_PROGRESS: number;
    RESOLVED: number;
    CLOSED: number;
  };
  byPriority: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  unassigned: number;
  overdue: number;
  needsManualTriage: number;
  avgFirstResponseHours: number | null;
}

export interface AdminQueueFilters {
  page?: number;
  limit?: number;
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: Priority;
  assignedTo?: string; // 'me' | 'unassigned' | <userId>
  needsManualTriage?: boolean | 'true' | 'false';
  overdue?: boolean | 'true' | 'false';
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  q?: string;
  sort?: 'urgency' | 'newest' | 'oldest';
}

export interface PatchTicketRequest {
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: Priority;
  assignedToId?: string | null;
}

export interface CreateNoteRequest {
  body: string;
  attachments?: AttachmentMeta[];
}

export interface AdminReplyRequest {
  body: string;
  draftId?: string;
  attachments?: AttachmentMeta[];
}

export interface AdminReplyResponse {
  message: TicketMessage;
  ticket: AdminTicket;
  firstResponseRecorded: boolean;
  statusChanged: boolean;
  editedFromDraft?: boolean;
}

export interface CannedSnippet {
  id: string;
  title: string;
  template: string;
}

export interface DraftDetail {
  id: string;
  ticketId: string;
  category?: TicketCategory | null;
  basedOnMessageId?: string | null;
  body: string;
  warnings: string[];
  createdAt: string;
  provider: string;
  model: string;
  stale: boolean;
}

export interface DraftResponse {
  status: 'ready' | 'unavailable' | 'idle';
  draft: DraftDetail | null;
  snippets?: CannedSnippet[];
  reason?: string;
  categoryProvisional?: boolean;
}
