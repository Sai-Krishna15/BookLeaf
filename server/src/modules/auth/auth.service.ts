import bcrypt from 'bcryptjs';
import { UnauthorizedError } from '../../common/errors';
import { signAccessToken } from '../../common/jwt';
import type { Role } from '../../generated/prisma/client';
import { authRepository } from './auth.repository';

const BCRYPT_COST = 10; // PROJECT_CONTEXT §5.2

// Unknown emails still pay for one bcrypt compare (same cost as a real one), so response time
// does not reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing-equalisation', BCRYPT_COST);

const INVALID_CREDENTIALS = 'Invalid email or password';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  authorId: string | null;
}

export const authService = {
  async login(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const user = await authRepository.findByEmail(email);

    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk) throw new UnauthorizedError(INVALID_CREDENTIALS);

    const token = signAccessToken({ id: user.id, role: user.role, authorId: user.authorId });
    // Explicit allow-list: passwordHash can never leak through this path.
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, authorId: user.authorId },
    };
  },

  /**
   * Assumption: response shape is `{ user, author }` where `author` is the profile for AUTHOR
   * users and `null` for admins.
   */
  async me(userId: string) {
    const row = await authRepository.findByIdWithAuthor(userId);
    // Valid token but the account no longer exists.
    if (!row) throw new UnauthorizedError('Account no longer exists');
    const { author, ...user } = row;
    return { user, author: author ?? null };
  },
};
