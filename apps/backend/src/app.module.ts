import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './database/prisma.module.js';
import { SecurityModule } from './security/security.module.js';
import { ConfigurationModule } from './config/configuration.module.js';
import { PrincipalResolverGuard } from './security/principal-resolver.guard.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from './common/guards/permissions.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor.js';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { FavoritesModule } from './modules/favorites/favorites.module.js';
import { BusinessesModule } from './modules/businesses/businesses.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { DeliveryModule } from './modules/delivery/delivery.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AdvertisementsModule } from './modules/advertisements/advertisements.module.js';

@Module({
  imports: [
    ConfigurationModule,
    PrismaModule,
    SecurityModule,
    AuthModule,
    UsersModule,
    HealthModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    FavoritesModule,
    BusinessesModule,
    ReviewsModule,
    DeliveryModule,
    AdminModule,
    AdvertisementsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_GUARD, useClass: PrincipalResolverGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
