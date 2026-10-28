import type {
  AttachmentMeta,
  FieldSource,
  Priority,
  TicketCategory,
  TicketMessage,
  TicketStatus,
  AiStatus,
} from '@/features/tickets/types';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
}

export interface AdminTicket {
  id: string;
  ticketNumber: string;
  authorId: string;
  bookId: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  category: TicketCategory | null;
  priority: Priority;
  categorySource: FieldSource;
  prioritySource: FieldSource;
  aiStatus: AiStatus;
  aiReasoning: string | null;
  needsManualTriage: boolean;
  assignedToId: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: AdminUser | null;
  author: {
    id: string;
    name: string;
    email: string;
  };
  book: {
    id: string;
    title: string;
    isbn: string | null;
    status: string;
  } | null;
  messages: TicketMessage[];
}

export interface AdminStats {
  openTickets: number;
  inProgressTickets: number;
  unassignedTickets: number;
  overdueTickets: number;
  needsTriageTickets: number;
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
  body: string;
}

export interface DraftDetail {
  id: string;
  body: string;
  model: string;
  confidence: number;
  createdAt: string;
}

export interface DraftResponse {
  status: 'ready' | 'generating' | 'unavailable';
  draft: DraftDetail | null;
  cannedSnippets?: CannedSnippet[];
  reason?: string;
}
