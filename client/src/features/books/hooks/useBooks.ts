import { useQuery } from '@tanstack/react-query';
import { booksApi, booksKeys } from '../books.api';

export function useBooks(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: booksKeys.list(params),
    queryFn: () => booksApi.getBooks(params),
  });
}

export function useBooksSummary() {
  return useQuery({
    queryKey: booksKeys.summary(),
    queryFn: () => booksApi.getBooksSummary(),
  });
}
