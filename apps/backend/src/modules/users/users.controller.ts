import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import {
  createZoneSchema,
  updateProfileSchema,
  updateZoneSchema,
  type CreateZoneRequest,
  type ProfileResponse,
  type UpdateProfileRequest,
  type UpdateZoneRequest,
  type ZoneResponse,
} from './dto/users.dto.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUserId } from '../../common/decorators/current-principal.decorator.js';
import { PERMISSIONS } from '@damazon/shared-types';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';

@Controller('users')
export class UsersController {
  public constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get('profile')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  public getProfile(@CurrentUserId() userId: string): Promise<ProfileResponse> {
    return this.usersService.getProfile(userId);
  }

  @Put('profile')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  public updateProfile(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(updateProfileSchema, { target: 'body' }))
    payload: UpdateProfileRequest,
  ): Promise<ProfileResponse> {
    return this.usersService.updateProfile(userId, payload);
  }

  @Get('zones')
  @RequirePermissions(PERMISSIONS.ZONE_READ)
  public listZones(@CurrentUserId() userId: string): Promise<readonly ZoneResponse[]> {
    return this.usersService.listZones(userId);
  }

  @Post('zones')
  @RequirePermissions(PERMISSIONS.ZONE_CREATE)
  public createZone(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(createZoneSchema, { target: 'body' })) payload: CreateZoneRequest,
  ): Promise<ZoneResponse> {
    return this.usersService.createZone(userId, payload);
  }

  @Patch('zones/:zoneId')
  @RequirePermissions(PERMISSIONS.ZONE_UPDATE)
  public updateZone(
    @CurrentUserId() userId: string,
    @Param('zoneId') zoneId: string,
    @Body(new ZodValidationPipe(updateZoneSchema, { target: 'body' })) payload: UpdateZoneRequest,
  ): Promise<ZoneResponse> {
    return this.usersService.updateZone(userId, zoneId, payload);
  }

  @Delete('zones/:zoneId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.ZONE_DELETE)
  public deleteZone(
    @CurrentUserId() userId: string,
    @Param('zoneId') zoneId: string,
  ): Promise<void> {
    return this.usersService.deleteZone(userId, zoneId);
  }
}
