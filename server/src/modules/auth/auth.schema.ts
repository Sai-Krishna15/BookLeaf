import { z } from 'zod';

export const loginBodySchema = z.object({
  // Normalized here (trim + lowercase) so the service always sees canonical emails.
  email: z.string().trim().toLowerCase().pipe(z.email('A valid email is required').max(254)),
  // Not trimmed: passwords are compared exactly. max(200) bounds bcrypt work on hostile input.
  password: z.string().min(1, 'Password is required').max(200),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
