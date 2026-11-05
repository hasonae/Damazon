import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@prisma/client';

import type { PrismaService } from '../src/database/prisma.service.js';
import { UsersService } from '../src/modules/users/users.service.js';

describe('UsersService profile verification state', () => {
  const user = {
    id: 'user-id',
    firstName: 'Test',
    lastName: 'User',
    phone: '+963941000001',
    email: 'test@example.com',
    avatarUrl: null,
    locale: 'ar',
    phoneVerifiedAt: null,
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  } as User;
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue(user),
    },
  } as unknown as PrismaService;
  const service = new UsersService(prisma);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findUnique = vi.fn().mockResolvedValue(user);
  });

  it('returns email verification state with the profile', async () => {
    await expect(service.getProfile(user.id)).resolves.toMatchObject({
      email: user.email,
      phoneVerified: false,
      emailVerified: true,
    });
  });

  it('rejects email changes until a verification flow exists', async () => {
    await expect(
      service.updateProfile(user.id, { email: 'new@example.com' }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
