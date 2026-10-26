import { prisma } from '../../config/prisma';

/** Only repositories touch Prisma. */
export const authRepository = {
  /** Includes passwordHash: for the login service only. Never serialize this row. */
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findByIdWithAuthor(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        authorId: true,
        author: {
          select: { id: true, name: true, email: true, phone: true, city: true, joinedDate: true },
        },
      },
    });
  },
};
