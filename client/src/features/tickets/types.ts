import type { PaginationMeta } from '@/components/common/Pagination';
import type { Role } from '@/features/auth/types';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type TicketCategory =
  | 'ROYALTY_PAYMENTS'
  | 'ISBN_METADATA'
  | 'PRINTING_QUALITY'
  | 'DISTRIBUTION_AVAILABILITY'
  | 'BOOK_STATUS_PRODUCTION'
  | 'GENERAL_INQUIRY';

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type FieldSource = 'AI' | 'FALLBACK' | 'ADMIN';

export type AiStatus = 'PENDING' | 'DONE' | 'FAILED' | 'SKIPPED';

export type MessageType = 'AUTHOR_MESSAGE' | 'ADMIN_REPLY' | 'INTERNAL_NOTE';

export interface AttachmentMeta {
  name: string;
  size: number;
  mimeType: string;
  url?: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  type: MessageType;
  body: string;
  aiAssisted: boolean;
  draftId?: string | null;
  attachments: AttachmentMeta[];
  createdAt: string;
  sender: {
    id: string;
    name: string;
    role: Role;
  };
}

export interface AuthorTicket {
  id: string;
  ticketNumber: string;
  authorId: string;
  bookId: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  book: {
    id: string;
    title: string;
    isbn: string | null;
    status: string;
  } | null;
  messages: TicketMessage[];
}

export interface TicketListResponse<T = AuthorTicket> {
  items: T[];
  meta: PaginationMeta;
}

export interface CreateTicketRequest {
  bookId?: string | null;
  subject: string;
  description: string;
  attachments?: AttachmentMeta[];
}

export interface CreateMessageRequest {
  body: string;
  attachments?: AttachmentMeta[];
}
