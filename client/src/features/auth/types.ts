export type Role = 'AUTHOR' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  authorId: string | null;
}

export interface AuthorProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface MeResponse {
  user: User;
  author: AuthorProfile | null;
}
