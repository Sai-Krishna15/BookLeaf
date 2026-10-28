import { api } from '@/lib/api';
import type {
  AdminReplyRequest,
  AdminReplyResponse,
  AdminStats,
  AdminTicket,
  CreateNoteRequest,
  DraftResponse,
  PatchTicketRequest,
} from './types';
import type { TicketListResponse, TicketMessage } from '@/features/tickets/types';

export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  tickets: () => [...adminKeys.all, 'tickets'] as const,
  ticketList: (params?: Record<string, unknown>) => [...adminKeys.tickets(), 'list', params] as const,
  ticketDetail: (id: string) => [...adminKeys.tickets(), 'detail', id] as const,
  draft: (id: string) => [...adminKeys.tickets(), 'draft', id] as const,
};

export const adminApi = {
  async getTickets(params?: Record<string, unknown>): Promise<TicketListResponse<AdminTicket>> {
    const res = await api.get<TicketListResponse<AdminTicket>>('/admin/tickets', { params });
    return res.data;
  },

  async getTicket(id: string): Promise<AdminTicket> {
    const res = await api.get<AdminTicket>(`/admin/tickets/${id}`);
    return res.data;
  },

  async getStats(): Promise<AdminStats> {
    const res = await api.get<AdminStats>('/admin/stats');
    return res.data;
  },

  async patchTicket(id: string, payload: PatchTicketRequest): Promise<AdminTicket> {
    const res = await api.patch<AdminTicket>(`/admin/tickets/${id}`, payload);
    return res.data;
  },

  async assignToMe(id: string): Promise<AdminTicket> {
    const res = await api.post<AdminTicket>(`/admin/tickets/${id}/assign-me`);
    return res.data;
  },

  async addNote(id: string, payload: CreateNoteRequest): Promise<TicketMessage> {
    const res = await api.post<TicketMessage>(`/admin/tickets/${id}/notes`, payload);
    return res.data;
  },

  async reply(id: string, payload: AdminReplyRequest): Promise<AdminReplyResponse> {
    const res = await api.post<AdminReplyResponse>(`/admin/tickets/${id}/reply`, payload);
    return res.data;
  },

  async getDraft(id: string): Promise<DraftResponse> {
    const res = await api.get<DraftResponse>(`/admin/tickets/${id}/draft`);
    return res.data;
  },

  async regenerateDraft(id: string): Promise<DraftResponse> {
    const res = await api.post<DraftResponse>(`/admin/tickets/${id}/draft/regenerate`);
    return res.data;
  },
};
