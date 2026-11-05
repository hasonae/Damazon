import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { buildPage, decodeCursor, encodeCursor, type PaginatedResult } from '@damazon/shared-types';

import { ResourceNotFoundError } from '../../common/errors/domain.error.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  productDetailInclude,
  productSummaryInclude,
  publicBusinessFilter,
  toProductDetail,
  toProductSummary,
  visibleProductFilter,
} from './catalog.mapper.js';
import type {
  CategoryNode,
  ListProductsQuery,
  ProductDetail,
  ProductSummary,
  StoreProfile,
} from './dto/catalog.dto.js';

/** Cursor marker for offset-based sorting (price, rating). */
const OFFSET_PREFIX = 'o';

type ParsedCursor =
  | { readonly kind: 'offset'; readonly offset: number }
  | { readonly kind: 'keyset'; readonly createdAt: string; readonly id: string };

function encodeOffsetCursor(offset: number): string {
  return encodeCursor(new Date(0), `${OFFSET_PREFIX}${offset}`);
}

/**
 * Returns null for a malformed cursor instead of throwing: a stale bookmark
 * in the address bar should reload the first page, not fail the request.
 * Offset cursors are only ever produced by value sorts, and since id values
 * are UUIDs (hex), the `o` prefix can never collide with a keyset id.
 */
function parseCursor(cursor: string): ParsedCursor | null {
  try {
    const { createdAt, id } = decodeCursor(cursor);
    if (id.startsWith(OFFSET_PREFIX)) {
      const offset = Number(id.slice(OFFSET_PREFIX.length));
      return Number.isInteger(offset) && offset >= 0 ? { kind: 'offset', offset } : null;
    }
    return { kind: 'keyset', createdAt, id };
  } catch {
    return null;
  }
}

@Injectable()
export class CatalogService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Full active category tree, unlimited depth, built from one flat query so
   * a deep hierarchy never costs one query per level.
   */
  public async listCategories(): Promise<readonly CategoryNode[]> {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }, { nameEn: 'asc' }],
    });

    interface MutableNode {
      id: string;
      slug: string;
      nameAr: string;
      nameEn: string;
      imageUrl: string | null;
      children: MutableNode[];
    }

    const nodes = new Map<string, MutableNode>();
    const roots: MutableNode[] = [];

    for (const row of rows) {
      nodes.set(row.id, {
        id: row.id,
        slug: row.slug,
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        imageUrl: row.imageUrl,
        children: [],
      });
    }
    for (const row of rows) {
      const node = nodes.get(row.id);
      if (node === undefined) {
        continue;
      }
      const parent = row.parentId === null ? undefined : nodes.get(row.parentId);
      if (parent === undefined) {
        roots.push(node);
      } else {
        parent.children.push(node);
      }
    }

    const strip = (node: MutableNode): CategoryNode => ({
      id: node.id,
      slug: node.slug,
      nameAr: node.nameAr,
      nameEn: node.nameEn,
      imageUrl: node.imageUrl,
      children: node.children.map(strip),
    });

    return roots.map(strip);
  }

  public async listProducts(query: ListProductsQuery): Promise<PaginatedResult<ProductSummary>> {
    const where = this.buildProductWhere(query);
    const limit = query.limit;

    // `newest` pages with a keyset cursor so inserts and deletes between
    // pages cannot duplicate or skip rows; value sorts need an offset cursor
    // because the sort key is not unique enough to keyset on.
    if (query.sort === 'newest') {
      return this.listNewest(where, query, limit);
    }
    return this.listSorted(where, query, limit);
  }

  public async getProduct(productId: string): Promise<ProductDetail> {
    const row = await this.prisma.product.findFirst({
      where: { id: productId, ...visibleProductFilter() },
      include: productDetailInclude,
    });
    if (row === null) {
      throw new ResourceNotFoundError('Product', productId);
    }
    return toProductDetail(row);
  }

  public async getStore(businessId: string): Promise<StoreProfile> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ...publicBusinessFilter() },
      include: { city: { select: { nameEn: true, nameAr: true } } },
    });
    if (business === null) {
      throw new ResourceNotFoundError('Store', businessId);
    }
    const productCount = await this.prisma.product.count({
      where: { businessId: business.id, ...visibleProductFilter() },
    });
    return {
      id: business.id,
      name: business.name,
      description: business.description,
      logoUrl: business.logoUrl,
      coverImageUrl: business.coverImageUrl,
      phone: business.phone,
      type: business.type,
      city: business.city === null ? null : business.city.nameAr,
      ratingAverage: String(business.ratingAverage),
      ratingCount: business.ratingCount,
      productCount,
      createdAt: business.createdAt.toISOString(),
    };
  }

  private buildProductWhere(query: ListProductsQuery): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = { ...visibleProductFilter() };

    if (query.categoryId !== undefined) {
      where.categoryId = query.categoryId;
    }
    if (query.businessId !== undefined) {
      where.businessId = query.businessId;
    }
    if (query.q !== undefined) {
      where.OR = [
        { nameAr: { contains: query.q, mode: 'insensitive' } },
        { nameEn: { contains: query.q, mode: 'insensitive' } },
        { sku: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private async listNewest(
    where: Prisma.ProductWhereInput,
    query: ListProductsQuery,
    limit: number,
  ): Promise<PaginatedResult<ProductSummary>> {
    const keysetWhere: Prisma.ProductWhereInput = { ...where };
    const parsed = query.cursor === undefined ? null : parseCursor(query.cursor);
    if (parsed !== null && parsed.kind === 'keyset') {
      const { createdAt, id } = parsed;
      keysetWhere.AND = [{ OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] }];
    }

    const rows = await this.prisma.product.findMany({
      where: keysetWhere,
      include: productSummaryInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const totalItems = await this.prisma.product.count({ where });
    const last = page[page.length - 1];

    return buildPage(
      page.map(toProductSummary),
      limit,
      hasMore,
      hasMore && last !== undefined ? encodeCursor(last.createdAt, last.id) : null,
      totalItems,
    );
  }

  private async listSorted(
    where: Prisma.ProductWhereInput,
    query: ListProductsQuery,
    limit: number,
  ): Promise<PaginatedResult<ProductSummary>> {
    const parsed = query.cursor === undefined ? null : parseCursor(query.cursor);
    const offset = parsed !== null && parsed.kind === 'offset' ? parsed.offset : 0;

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === 'price_asc'
        ? [{ priceMinor: 'asc' }, { id: 'asc' }]
        : query.sort === 'price_desc'
          ? [{ priceMinor: 'desc' }, { id: 'asc' }]
          : [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }, { id: 'asc' }];

    const [rows, totalItems] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: productSummaryInclude,
        orderBy,
        skip: offset,
        take: limit + 1,
      }),
      this.prisma.product.count({ where }),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return buildPage(
      page.map(toProductSummary),
      limit,
      hasMore,
      hasMore ? encodeOffsetCursor(offset + limit) : null,
      totalItems,
    );
  }
}
