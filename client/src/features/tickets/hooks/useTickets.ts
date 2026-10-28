import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ticketsApi, ticketsKeys } from '../tickets.api';
import type { CreateMessageRequest, CreateTicketRequest } from '../types';

export function useTickets(params?: {
  status?: string;
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
}) {
  return useQuery({
    queryKey: ticketsKeys.list(params),
    queryFn: () => ticketsApi.getTickets(params),
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ticketsKeys.detail(id),
    queryFn: () => ticketsApi.getTicket(id),
    enabled: !!id,
  });
}

export function useTicketMessages(id: string) {
  return useQuery({
    queryKey: ticketsKeys.messages(id),
    queryFn: () => ticketsApi.getMessages(id),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTicketRequest) => ticketsApi.createTicket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketsKeys.lists() });
    },
  });
}

export function useSendFollowUp(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMessageRequest) => ticketsApi.addMessage(ticketId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketsKeys.detail(ticketId) });
      queryClient.invalidateQueries({ queryKey: ticketsKeys.messages(ticketId) });
      queryClient.invalidateQueries({ queryKey: ticketsKeys.lists() });
    },
  });
}
