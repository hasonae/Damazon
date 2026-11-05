import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UsersModule } from '../users/users.module.js';
import { SecurityModule } from '../../security/security.module.js';
import { EMAIL_DELIVERY, SmtpEmailDelivery } from './email-delivery.service.js';

@Module({
  imports: [UsersModule, SecurityModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SmtpEmailDelivery,
    { provide: EMAIL_DELIVERY, useExisting: SmtpEmailDelivery },
  ],
  exports: [AuthService],
})
export class AuthModule {}
