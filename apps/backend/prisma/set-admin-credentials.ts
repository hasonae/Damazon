import './load-env.js';
import { PrismaClient } from '@prisma/client';
import { parseSyrianPhone } from '@damazon/utilities';
import { buildConfiguration, environmentSchema } from '../src/config/environment.js';
import { PasswordService } from '../src/security/password.service.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const phone = process.env.ADMIN_PHONE?.trim();
  const firstName = process.env.ADMIN_FIRST_NAME?.trim();
  const lastName = process.env.ADMIN_LAST_NAME?.trim();
  const parsedPhone = phone === undefined ? undefined : parseSyrianPhone(phone);
  if (username === undefined || !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    throw new Error('ADMIN_USERNAME must be 3-32 letters, digits, dots, underscores, or hyphens');
  }
  if (password === undefined || password.length === 0) {
    throw new Error('ADMIN_PASSWORD must be supplied through the process environment');
  }
  if (phone !== undefined && parsedPhone === null) {
    throw new Error('ADMIN_PHONE must be a valid Syrian mobile number when provided');
  }

  const environment = environmentSchema.parse(process.env);
  const passwordService = new PasswordService(buildConfiguration(environment));
  const administrators = await prisma.user.findMany({
    where: {
      roles: { some: { role: 'admin', status: 'APPROVED' } },
      adminProfile: { is: { department: 'super_admin' } },
    },
    select: { id: true },
    take: 2,
  });
  if (administrators.length > 1) {
    throw new Error(
      `Expected at most one approved super-admin account; found ${administrators.length}`,
    );
  }

  const passwordHash = await passwordService.hash(password);
  if (administrators.length === 0) {
    if (parsedPhone === undefined || parsedPhone === null) {
      throw new Error(
        'ADMIN_PHONE must be a valid Syrian mobile number when creating the first admin',
      );
    }
    if (firstName === undefined || firstName.length < 2 || firstName.length > 80) {
      throw new Error(
        'ADMIN_FIRST_NAME must contain 2-80 characters when creating the first admin',
      );
    }
    if (lastName === undefined || lastName.length < 2 || lastName.length > 80) {
      throw new Error('ADMIN_LAST_NAME must contain 2-80 characters when creating the first admin');
    }

    await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          firstName,
          lastName,
          phone: parsedPhone.e164,
          username,
          passwordHash,
          locale: 'ar',
          status: 'ACTIVE',
          roles: {
            create: {
              role: 'admin',
              status: 'APPROVED',
              reviewedAt: new Date(),
            },
          },
          adminProfile: {
            create: { department: 'super_admin', permissions: [] },
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          action: 'create',
          entityType: 'admin_profile',
          entityId: user.id,
          newValue: { source: 'secure_initial_admin_setup' },
        },
      });
    });
    process.stdout.write('Initial super-admin account created securely.\n');
    return;
  }

  const administrator = administrators[0];
  if (administrator === undefined) {
    throw new Error('The super-admin account could not be resolved');
  }

  await prisma.user.update({
    where: { id: administrator.id },
    data: {
      username,
      passwordHash,
      ...(parsedPhone == null ? {} : { phone: parsedPhone.e164 }),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  process.stdout.write('Super-admin login credentials updated.\n');
}

main()
  .catch((error: unknown) => {
    console.error('Could not update super-admin credentials.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
