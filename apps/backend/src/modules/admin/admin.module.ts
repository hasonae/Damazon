import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service.js';

@Module({
  controllers: [AdminController],
  providers: [AdminService, SubscriptionLifecycleService],
})
export class AdminModule {}
