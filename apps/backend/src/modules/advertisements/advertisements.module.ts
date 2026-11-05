import { Module } from '@nestjs/common';

import {
  AdminAdvertisementsController,
  PublicAdvertisementsController,
} from './advertisements.controller.js';
import { AdvertisementsService } from './advertisements.service.js';

@Module({
  controllers: [PublicAdvertisementsController, AdminAdvertisementsController],
  providers: [AdvertisementsService],
  exports: [AdvertisementsService],
})
export class AdvertisementsModule {}
