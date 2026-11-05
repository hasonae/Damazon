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
} from '@nestjs/common';

import { CurrentUserId } from '../../common/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PERMISSIONS } from '@damazon/shared-types';

import { CartService } from './cart.service.js';
import {
  addCartItemSchema,
  itemIdParamSchema,
  updateCartItemSchema,
  type AddCartItemRequest,
  type CartResponse,
  type UpdateCartItemRequest,
} from './dto/cart.dto.js';

@Controller('cart')
export class CartController {
  public constructor(@Inject(CartService) private readonly cartService: CartService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CART_READ)
  public getCart(@CurrentUserId() userId: string): Promise<CartResponse> {
    return this.cartService.getCart(userId);
  }

  @Post('items')
  @RequirePermissions(PERMISSIONS.CART_MANAGE)
  public addItem(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(addCartItemSchema, { target: 'body' })) payload: AddCartItemRequest,
  ): Promise<CartResponse> {
    return this.cartService.addItem(userId, payload);
  }

  @Patch('items/:itemId')
  @RequirePermissions(PERMISSIONS.CART_MANAGE)
  public updateItem(
    @CurrentUserId() userId: string,
    @Param('itemId', new ZodValidationPipe(itemIdParamSchema, { target: 'params' }))
    itemId: string,
    @Body(new ZodValidationPipe(updateCartItemSchema, { target: 'body' }))
    payload: UpdateCartItemRequest,
  ): Promise<CartResponse> {
    return this.cartService.updateItem(userId, itemId, payload);
  }

  @Delete('items/:itemId')
  @RequirePermissions(PERMISSIONS.CART_MANAGE)
  public removeItem(
    @CurrentUserId() userId: string,
    @Param('itemId', new ZodValidationPipe(itemIdParamSchema, { target: 'params' }))
    itemId: string,
  ): Promise<CartResponse> {
    return this.cartService.removeItem(userId, itemId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.CART_MANAGE)
  public clearCart(@CurrentUserId() userId: string): Promise<void> {
    return this.cartService.clearCart(userId);
  }
}
