import { api } from '@/lib/api';
import type { Book, BookListResponse, BooksSummary } from './types';

export const booksKeys = {
  all: ['books'] as const,
  lists: () => [...booksKeys.all, 'list'] as const,
  list: (params?: { page?: number; limit?: number }) => [...booksKeys.lists(), params] as const,
  summary: () => [...booksKeys.all, 'summary'] as const,
  details: () => [...booksKeys.all, 'detail'] as const,
  detail: (id: string) => [...booksKeys.details(), id] as const,
};

export const booksApi = {
  async getBooks(params?: { page?: number; limit?: number }): Promise<BookListResponse> {
    const res = await api.get<BookListResponse>('/books', { params });
    return res.data;
  },

  async getBooksSummary(): Promise<BooksSummary> {
    const res = await api.get<BooksSummary>('/books/summary');
    return res.data;
  },

  async getBook(id: string): Promise<Book> {
    const res = await api.get<Book>(`/books/${id}`);
    return res.data;
  },
};
