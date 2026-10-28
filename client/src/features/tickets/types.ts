import type { PaginationMeta } from '@/components/common/Pagination';

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
  type: MessageType;
  body: string;
  aiAssisted: boolean;
  createdAt: string;
  sender: {
    id: string;
    displayName: string;
  };
}

export interface AuthorTicket {
  id: string;
  ticketNumber: string;
  ticketNumberRaw?: number;
  subject: string;
  description: string;
  status: TicketStatus;
  book: {
    id: string;
    title: string;
  } | null;
  attachments: AttachmentMeta[];
  createdAt: string;
  updatedAt: string;
  messages?: TicketMessage[];
}

export interface TicketListResponse<T = AuthorTicket> {
  data: T[];
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
