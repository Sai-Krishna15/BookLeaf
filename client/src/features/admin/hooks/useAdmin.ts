import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminApi, adminKeys } from '../admin.api';
import type { AdminQueueFilters, AdminTicket, PatchTicketRequest } from '../types';
import type { TicketListResponse } from '@/features/tickets/types';
import { useAuth } from '@/features/auth/useAuth';
import { ApiError } from '@/lib/api';

export function useAdminTickets(filters?: AdminQueueFilters) {
  return useQuery({
    queryKey: adminKeys.ticketList(filters as Record<string, unknown>),
    queryFn: () => adminApi.getTickets(filters),
    placeholderData: keepPreviousData,
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => adminApi.getStats(),
  });
}

export function useAdmins() {
  return useQuery({
    queryKey: adminKeys.admins(),
    queryFn: () => adminApi.getAdmins(),
  });
}

export function usePatchTicket() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PatchTicketRequest }) =>
      adminApi.patchTicket(id, payload),
    onMutate: async ({ id, payload }) => {
      // Cancel outgoing queries to avoid overwriting optimistic updates
      await queryClient.cancelQueries({ queryKey: adminKeys.tickets() });

      // Snapshot previous list queries
      const previousLists = queryClient.getQueriesData<TicketListResponse<AdminTicket>>({
        queryKey: adminKeys.tickets(),
      });
      const previousDetail = queryClient.getQueryData<AdminTicket>(adminKeys.ticketDetail(id));

      // Optimistically update list queries
      queryClient.setQueriesData<TicketListResponse<AdminTicket>>(
        { queryKey: adminKeys.tickets() },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((t) => {
              if (t.id !== id) return t;
              const newAssignedToId =
                payload.assignedToId !== undefined
                  ? payload.assignedToId
                  : (t.assignedToId || t.assignedTo?.id || null);
              let newAssignedTo = t.assignedTo;
              if (payload.assignedToId !== undefined) {
                if (payload.assignedToId === null) {
                  newAssignedTo = null;
                } else if (user && payload.assignedToId === user.id) {
                  newAssignedTo = { id: user.id, name: user.name };
                }
              }
              return {
                ...t,
                status: payload.status ?? t.status,
                category: payload.category ?? t.category,
                priority: payload.priority ?? t.priority,
                assignedToId: newAssignedToId,
                assignedTo: newAssignedTo,
                needsManualTriage:
                  payload.category || payload.priority ? false : t.needsManualTriage,
                categorySource: payload.category ? 'ADMIN' : t.categorySource,
                prioritySource: payload.priority ? 'ADMIN' : t.prioritySource,
                resolvedAt:
                  payload.status === 'RESOLVED' || payload.status === 'CLOSED'
                    ? t.resolvedAt || new Date().toISOString()
                    : payload.status === 'OPEN' || payload.status === 'IN_PROGRESS'
                      ? null
                      : t.resolvedAt,
              };
            }),
          };
        },
      );

      // Optimistically update detail query
      if (previousDetail) {
        const newAssignedToId =
          payload.assignedToId !== undefined
            ? payload.assignedToId
            : (previousDetail.assignedToId || previousDetail.assignedTo?.id || null);
        let newAssignedTo = previousDetail.assignedTo;
        if (payload.assignedToId !== undefined) {
          if (payload.assignedToId === null) {
            newAssignedTo = null;
          } else if (user && payload.assignedToId === user.id) {
            newAssignedTo = { id: user.id, name: user.name };
          }
        }
        queryClient.setQueryData<AdminTicket>(adminKeys.ticketDetail(id), {
          ...previousDetail,
          status: payload.status ?? previousDetail.status,
          category: payload.category ?? previousDetail.category,
          priority: payload.priority ?? previousDetail.priority,
          assignedToId: newAssignedToId,
          assignedTo: newAssignedTo,
          needsManualTriage:
            payload.category || payload.priority ? false : previousDetail.needsManualTriage,
          categorySource: payload.category ? 'ADMIN' : previousDetail.categorySource,
          prioritySource: payload.priority ? 'ADMIN' : previousDetail.prioritySource,
          resolvedAt:
            payload.status === 'RESOLVED' || payload.status === 'CLOSED'
              ? previousDetail.resolvedAt || new Date().toISOString()
              : payload.status === 'OPEN' || payload.status === 'IN_PROGRESS'
                ? null
                : previousDetail.resolvedAt,
        });
      }

      return { previousLists, previousDetail };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(adminKeys.ticketDetail(data.id), data);
      queryClient.setQueriesData<TicketListResponse<AdminTicket>>(
        { queryKey: adminKeys.tickets() },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((t) => (t.id === data.id ? { ...t, ...data } : t)),
          };
        },
      );
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(adminKeys.ticketDetail(id), context.previousDetail);
      }

      const msg =
        err instanceof ApiError
          ? err.message
          : 'Failed to update ticket. Please try again.';
      toast.error(msg);
    },
    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tickets() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ticketDetail(id) });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}

export function useAssignMe() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (ticketId: string) => adminApi.assignToMe(ticketId),
    onMutate: async (ticketId) => {
      await queryClient.cancelQueries({ queryKey: adminKeys.tickets() });

      const previousLists = queryClient.getQueriesData<TicketListResponse<AdminTicket>>({
        queryKey: adminKeys.tickets(),
      });
      const previousDetail = queryClient.getQueryData<AdminTicket>(adminKeys.ticketDetail(ticketId));

      const selfAssignee = user ? { id: user.id, name: user.name } : null;

      queryClient.setQueriesData<TicketListResponse<AdminTicket>>(
        { queryKey: adminKeys.tickets() },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((t) => {
              if (t.id !== ticketId) return t;
              return {
                ...t,
                assignedToId: user?.id ?? t.assignedToId,
                assignedTo: selfAssignee ?? t.assignedTo,
              };
            }),
          };
        },
      );

      if (previousDetail && user) {
        queryClient.setQueryData<AdminTicket>(adminKeys.ticketDetail(ticketId), {
          ...previousDetail,
          assignedToId: user.id,
          assignedTo: selfAssignee,
        });
      }

      return { previousLists, previousDetail };
    },
    onSuccess: (data) => {
      toast.success(`Assigned ticket ${data.ticketNumber} to you`);
      queryClient.setQueryData(adminKeys.ticketDetail(data.id), data);
      queryClient.setQueriesData<TicketListResponse<AdminTicket>>(
        { queryKey: adminKeys.tickets() },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((t) => (t.id === data.id ? { ...t, ...data } : t)),
          };
        },
      );
    },
    onError: (err, ticketId, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(adminKeys.ticketDetail(ticketId), context.previousDetail);
      }

      const msg =
        err instanceof ApiError ? err.message : 'Failed to assign ticket to you.';
      toast.error(msg);
    },
    onSettled: (_data, _error, ticketId) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tickets() });
      queryClient.invalidateQueries({ queryKey: adminKeys.ticketDetail(ticketId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    },
  });
}
