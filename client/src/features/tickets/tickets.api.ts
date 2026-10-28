import { api } from '@/lib/api';
import type {
  AuthorTicket,
  CreateMessageRequest,
  CreateTicketRequest,
  TicketListResponse,
  TicketMessage,
} from './types';

export const ticketsKeys = {
  all: ['tickets'] as const,
  lists: () => [...ticketsKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...ticketsKeys.lists(), params] as const,
  details: () => [...ticketsKeys.all, 'detail'] as const,
  detail: (id: string) => [...ticketsKeys.details(), id] as const,
  messages: (id: string) => [...ticketsKeys.detail(id), 'messages'] as const,
};

export const ticketsApi = {
  async getTickets(params?: {
    status?: string;
    page?: number;
    limit?: number;
    q?: string;
    sort?: string;
  }): Promise<TicketListResponse> {
    const res = await api.get<TicketListResponse>('/tickets', { params });
    return res.data;
  },

  async getTicket(id: string): Promise<AuthorTicket> {
    const res = await api.get<AuthorTicket>(`/tickets/${id}`);
    return res.data;
  },

  async getMessages(id: string): Promise<TicketMessage[]> {
    const res = await api.get<TicketMessage[]>(`/tickets/${id}/messages`);
    return res.data;
  },

  async createTicket(payload: CreateTicketRequest): Promise<AuthorTicket> {
    const res = await api.post<AuthorTicket>('/tickets', payload);
    return res.data;
  },

  async addMessage(id: string, payload: CreateMessageRequest): Promise<TicketMessage> {
    const res = await api.post<TicketMessage>(`/tickets/${id}/messages`, payload);
    return res.data;
  },
};
