import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import type { Permission } from '@damazon/shared-types';

export const REQUIRED_PERMISSIONS_KEY = 'damazon:requiredPermissions';

export const RequirePermissions = (
  ...permissions: readonly Permission[]
): CustomDecorator<string> => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

export const RequireAllPermissions = RequirePermissions;

export const RequireAnyPermission = (
  permissions: readonly [Permission, ...Permission[]],
): CustomDecorator<string> => SetMetadata(`${REQUIRED_PERMISSIONS_KEY}:any`, permissions);
