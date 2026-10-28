import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminApi, adminKeys } from '../admin.api';
import { booksApi, booksKeys } from '@/features/books/books.api';
import type {
  AdminReplyRequest,
  AdminTicket,
  CreateNoteRequest,
  DraftResponse,
} from '../types';
import type { TicketMessage } from '@/features/tickets/types';
import { useAuth } from '@/features/auth/useAuth';
import { ApiError } from '@/lib/api';

export function useAdminTicket(id: string) {
  return useQuery({
    queryKey: adminKeys.ticketDetail(id),
    queryFn: () => adminApi.getTicket(id),
    enabled: Boolean(id),
  });
}

export function useTicketMessages(ticketId: string) {
  return useQuery({
    queryKey: adminKeys.ticketMessages(ticketId),
    queryFn: () => adminApi.getTicketMessages(ticketId),
    enabled: Boolean(ticketId),
  });
}

export function useBookFacts(bookId: string | null | undefined) {
  return useQuery({
    queryKey: booksKeys.detail(bookId || ''),
    queryFn: () => booksApi.getBook(bookId!),
    enabled: Boolean(bookId),
  });
}

export function useAuthorBooksSummary(authorId: string | null | undefined) {
  return useQuery({
    queryKey: adminKeys.authorSummary(authorId || ''),
    queryFn: () => adminApi.getAuthorSummary(authorId!),
    enabled: Boolean(authorId),
  });
}

export function useDraft(ticketId: string, enabled = true) {
  return useQuery<DraftResponse>({
    queryKey: adminKeys.draft(ticketId),
    queryFn: () => adminApi.getDraft(ticketId),
    enabled: Boolean(ticketId) && enabled,
    staleTime: 1000 * 60 * 5, // 5 min cache
  });
}

export function useRegenerateDraft(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => adminApi.regenerateDraft(ticketId),
    onSuccess: (data) => {
      queryClient.setQueryData(adminKeys.draft(ticketId), data);
      toast.success('AI draft regenerated');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 429) {
        toast.error('Draft regeneration rate limit reached (max 6/min). Please wait a moment.');
      } else {
        const msg = err instanceof ApiError ? err.message : 'Failed to regenerate draft.';
        toast.error(msg);
      }
    },
  });
}

export function useReply(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminReplyRequest) => adminApi.reply(ticketId, payload),
    onSuccess: (res) => {
      // Append message to message thread
      queryClient.setQueryData<TicketMessage[]>(adminKeys.ticketMessages(ticketId), (old) => {
        if (!old) return [res.message];
        if (old.some((m) => m.id === res.message.id)) return old;
        return [...old, res.message];
      });

      // Update ticket detail cache
      queryClient.setQueryData<AdminTicket>(adminKeys.ticketDetail(ticketId), (old) => {
        if (!old) return res.ticket;
        return {
          ...old,
          ...res.ticket,
          firstResponseAt: res.ticket.firstResponseAt ?? old.firstResponseAt,
          status: res.ticket.status,
        };
      });

      // Invalidate stats & tickets queue
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
      queryClient.invalidateQueries({ queryKey: adminKeys.tickets() });

      const detailMsg = res.editedFromDraft ? ' (with edits)' : '';
      toast.success(`Reply sent to ${res.ticket.author.name}${detailMsg}`);
    },
  });
}

export function useAddNote(ticketId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (payload: CreateNoteRequest) => adminApi.addNote(ticketId, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: adminKeys.ticketMessages(ticketId) });
      const previousMessages = queryClient.getQueryData<TicketMessage[]>(
        adminKeys.ticketMessages(ticketId),
      );

      // Optimistic note entry
      const optimisticNote: TicketMessage = {
        id: `temp-note-${Date.now()}`,
        ticketId,
        type: 'INTERNAL_NOTE',
        body: payload.body,
        aiAssisted: false,
        createdAt: new Date().toISOString(),
        sender: {
          id: user?.id || 'admin',
          displayName: user?.name || 'Staff Member',
        },
      };

      queryClient.setQueryData<TicketMessage[]>(adminKeys.ticketMessages(ticketId), (old) => {
        if (!old) return [optimisticNote];
        return [...old, optimisticNote];
      });

      return { previousMessages };
    },
    onError: (err, _payload, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(adminKeys.ticketMessages(ticketId), context.previousMessages);
      }
      const msg = err instanceof ApiError ? err.message : 'Failed to add internal note.';
      toast.error(msg);
    },
    onSuccess: (data) => {
      // Replace optimistic note with real data
      queryClient.setQueryData<TicketMessage[]>(adminKeys.ticketMessages(ticketId), (old) => {
        if (!old) return [data];
        return old.map((m) => (m.id.startsWith('temp-note-') ? data : m));
      });
      toast.success('Internal note added');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.ticketMessages(ticketId) });
    },
  });
}

export function useReclassify(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => adminApi.reclassify(ticketId),
    onSuccess: (updatedTicket) => {
      queryClient.setQueryData(adminKeys.ticketDetail(ticketId), updatedTicket);
      toast.info('AI reclassification in progress...');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.info('AI classification is already running for this ticket');
      } else {
        const msg = err instanceof ApiError ? err.message : 'Failed to trigger reclassification.';
        toast.error(msg);
      }
    },
  });
}
