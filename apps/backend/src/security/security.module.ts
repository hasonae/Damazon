import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigurationModule } from '../config/configuration.module.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    ConfigurationModule,
    JwtModule.register({
      secret: 'replace-with-a-dynamic-secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [PasswordService, JwtService, TokenService],
  exports: [JwtModule, PasswordService, TokenService],
})
export class SecurityModule {}
