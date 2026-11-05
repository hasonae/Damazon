import './load-env.js';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PasswordService } from '../src/security/password.service.js';
import { buildConfiguration, environmentSchema } from '../src/config/environment.js';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'Damaz0n!Seed2026';

const SYRIAN_CITIES = [
  { nameEn: 'Damascus', nameAr: 'دمشق', slug: 'damascus', latitude: 33.5138, longitude: 36.2765 },
  { nameEn: 'Aleppo', nameAr: 'حلب', slug: 'aleppo', latitude: 36.2021, longitude: 37.1343 },
  { nameEn: 'Homs', nameAr: 'حمص', slug: 'homs', latitude: 34.7324, longitude: 36.7137 },
  { nameEn: 'Latakia', nameAr: 'اللاذقية', slug: 'latakia', latitude: 35.5196, longitude: 35.7915 },
];

const ROOT_CATEGORIES = [
  {
    nameEn: 'Electronics',
    nameAr: 'إلكترونيات',
    slug: 'electronics',
    children: [
      { nameEn: 'Mobile Phones', nameAr: 'هواتف محمولة', slug: 'mobile-phones' },
      { nameEn: 'Laptops', nameAr: 'حواسيب محمولة', slug: 'laptops' },
      { nameEn: 'Audio', nameAr: 'صوتيات', slug: 'audio' },
    ],
  },
  {
    nameEn: 'Home and Kitchen',
    nameAr: 'منزل ومطبخ',
    slug: 'home-kitchen',
    children: [
      { nameEn: 'Cookware', nameAr: 'أواني طهي', slug: 'cookware' },
      { nameEn: 'Furniture', nameAr: 'أثاث', slug: 'furniture' },
    ],
  },
  {
    nameEn: 'Fashion',
    nameAr: 'أزياء',
    slug: 'fashion',
    children: [
      { nameEn: 'Men Clothing', nameAr: 'ملابس رجالية', slug: 'men-clothing' },
      { nameEn: 'Women Clothing', nameAr: 'ملابس نسائية', slug: 'women-clothing' },
    ],
  },
  {
    nameEn: 'Groceries',
    nameAr: 'مواد غذائية',
    slug: 'groceries',
    children: [
      { nameEn: 'Fresh Produce', nameAr: 'منتجات طازجة', slug: 'fresh-produce' },
      { nameEn: 'Pantry', nameAr: 'مواد معلبة', slug: 'pantry' },
    ],
  },
];

const SYSTEM_SETTINGS = [
  { key: 'platform.default_country', value: 'SY', description: 'Default country code' },
  { key: 'platform.default_currency', value: 'SYP', description: 'Default settlement currency' },
  { key: 'platform.default_locale', value: 'ar', description: 'Default interface language' },
  {
    key: 'orders.auto_confirm_after_payment',
    value: true,
    description: 'Auto confirm paid orders',
  },
  { key: 'payments.sham_cash_enabled', value: true, description: 'Sham Cash gateway availability' },
  {
    key: 'subscriptions.grace_period_days',
    value: 5,
    description: 'Grace period before suspension',
  },
  {
    key: 'delivery.default_service_level',
    value: 'standard',
    description: 'Default delivery service level',
  },
];

async function seedGeography(): Promise<void> {
  const country = await prisma.country.upsert({
    where: { isoCode: 'SY' },
    update: {},
    create: {
      isoCode: 'SY',
      nameEn: 'Syria',
      nameAr: 'سوريا',
      defaultCurrency: 'SYP',
      defaultTimeZone: 'Asia/Damascus',
      phoneCountryCode: '+963',
      isActive: true,
    },
  });

  for (const city of SYRIAN_CITIES) {
    await prisma.city.upsert({
      where: { countryId_slug: { countryId: country.id, slug: city.slug } },
      update: { ...city, countryId: country.id },
      create: { ...city, countryId: country.id, isActive: true },
    });
  }
  console.log(`Seeded country and ${SYRIAN_CITIES.length} cities`);
}

async function seedCatalog(): Promise<void> {
  for (const [rootIndex, root] of ROOT_CATEGORIES.entries()) {
    const parent = await prisma.category.upsert({
      where: { slug: root.slug },
      update: {},
      create: {
        nameEn: root.nameEn,
        nameAr: root.nameAr,
        slug: root.slug,
        position: rootIndex,
        isActive: true,
      },
    });
    for (const [childIndex, child] of root.children.entries()) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: {},
        create: {
          nameEn: child.nameEn,
          nameAr: child.nameAr,
          slug: child.slug,
          parentId: parent.id,
          position: childIndex,
          isActive: true,
        },
      });
    }
  }
  const total = await prisma.category.count();
  console.log(`Seeded ${total} categories`);
}

async function seedSettings(): Promise<void> {
  for (const setting of SYSTEM_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value as Prisma.InputJsonValue, description: setting.description },
      create: {
        key: setting.key,
        value: setting.value as Prisma.InputJsonValue,
        description: setting.description,
      },
    });
  }
  console.log(`Seeded ${SYSTEM_SETTINGS.length} system settings`);
}

interface SeedUser {
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: readonly (
    'customer' | 'merchant' | 'restaurant' | 'delivery_company' | 'driver' | 'admin'
  )[];
  adminDepartment?:
    | 'super_admin'
    | 'operations'
    | 'finance'
    | 'support'
    | 'marketing'
    | 'content'
    | 'moderation'
    | 'security';
}

const SEED_USERS: readonly SeedUser[] = [
  {
    phone: '+963941000001',
    firstName: 'Customer',
    lastName: 'Test',
    email: 'customer@damazon.test',
    roles: ['customer'],
  },
  {
    phone: '+963941000002',
    firstName: 'Merchant',
    lastName: 'Owner',
    email: 'merchant@damazon.test',
    roles: ['customer', 'merchant'],
  },
  {
    phone: '+963941000003',
    firstName: 'Restaurant',
    lastName: 'Owner',
    email: 'restaurant@damazon.test',
    roles: ['customer', 'restaurant'],
  },
  {
    phone: '+963941000004',
    firstName: 'Delivery',
    lastName: 'Manager',
    email: 'delivery@damazon.test',
    roles: ['customer', 'delivery_company'],
  },
  {
    phone: '+963941000005',
    firstName: 'Driver',
    lastName: 'Test',
    email: 'driver@damazon.test',
    roles: ['customer', 'driver'],
  },
  {
    phone: '+963941000006',
    firstName: 'Platform',
    lastName: 'Administrator',
    email: 'admin@damazon.test',
    roles: ['admin'],
    adminDepartment: 'super_admin',
  },
];

async function seedUsers(passwordHash: string): Promise<Map<string, string>> {
  const idsByPhone = new Map<string, string>();

  for (const seedUser of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { phone: seedUser.phone },
      update: { passwordHash, phoneVerifiedAt: new Date() },
      create: {
        firstName: seedUser.firstName,
        lastName: seedUser.lastName,
        phone: seedUser.phone,
        email: seedUser.email,
        passwordHash,
        locale: 'ar',
        status: 'ACTIVE',
        phoneVerifiedAt: new Date(),
      },
    });
    idsByPhone.set(seedUser.phone, user.id);

    for (const role of seedUser.roles) {
      await prisma.userRoleAssignment.upsert({
        where: { userId_role: { userId: user.id, role } },
        update: { status: 'APPROVED' },
        create: { userId: user.id, role, status: 'APPROVED', reviewedAt: new Date() },
      });
    }

    if (seedUser.adminDepartment) {
      await prisma.adminProfile.upsert({
        where: { userId: user.id },
        update: { department: seedUser.adminDepartment },
        create: { userId: user.id, department: seedUser.adminDepartment, permissions: [] },
      });
    }
  }

  console.log(`Seeded ${SEED_USERS.length} test accounts for every platform role`);
  return idsByPhone;
}

async function seedBusinesses(userIds: ReadonlyMap<string, string>): Promise<void> {
  const damascus = await prisma.city.findFirstOrThrow({
    where: { slug: 'damascus' },
    select: { id: true },
  });
  const mobilePhones = await prisma.category.findFirstOrThrow({
    where: { slug: 'mobile-phones' },
    select: { id: true },
  });

  const merchantOwnerId = userIds.get('+963941000002');
  if (merchantOwnerId) {
    const business = await prisma.business.upsert({
      where: { id: await findBusinessIdByOwner(merchantOwnerId, 'merchant') },
      update: {},
      create: {
        ownerId: merchantOwnerId,
        type: 'merchant',
        name: 'Damascus Electronics',
        legalName: 'Damascus Electronics Trading',
        description: 'Consumer electronics store in Damascus',
        phone: '+963941000002',
        addressLine: 'Al Hamra Street, Damascus',
        latitude: 33.5138,
        longitude: 36.2765,
        cityId: damascus.id,
        status: 'ACTIVE',
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
    });
    await ensureSubscription(business.id, 'merchant_monthly', 500);
    await prisma.product.upsert({
      where: { businessId_sku: { businessId: business.id, sku: 'DMZ-PH-001' } },
      update: {},
      create: {
        businessId: business.id,
        categoryId: mobilePhones.id,
        sku: 'DMZ-PH-001',
        nameEn: 'Smartphone 128GB',
        nameAr: 'هاتف ذكي ١٢٨ غيغابايت',
        description: 'Unlocked dual SIM smartphone',
        priceMinor: 4_500_000,
        currency: 'SYP',
        stockQuantity: 40,
        lowStockThreshold: 5,
        status: 'active',
        isAvailable: true,
      },
    });
    await prisma.product.upsert({
      where: { businessId_sku: { businessId: business.id, sku: 'DMZ-PH-002' } },
      update: {},
      create: {
        businessId: business.id,
        categoryId: mobilePhones.id,
        sku: 'DMZ-PH-002',
        nameEn: 'Budget Smartphone 64GB',
        nameAr: 'هاتف اقتصادي ٦٤ غيغابايت',
        priceMinor: 1_800_000,
        currency: 'SYP',
        stockQuantity: 120,
        lowStockThreshold: 10,
        status: 'active',
        isAvailable: true,
      },
    });
  }

  const restaurantOwnerId = userIds.get('+963941000003');
  if (restaurantOwnerId) {
    const restaurant = await prisma.business.upsert({
      where: { id: await findBusinessIdByOwner(restaurantOwnerId, 'restaurant') },
      update: {},
      create: {
        ownerId: restaurantOwnerId,
        type: 'restaurant',
        name: 'Shami Kitchen',
        legalName: 'Shami Kitchen Restaurant',
        description: 'Traditional Syrian food',
        phone: '+963941000003',
        addressLine: 'Al Bustan Road, Damascus',
        latitude: 33.5211,
        longitude: 36.2881,
        cityId: damascus.id,
        status: 'ACTIVE',
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
    });
    await prisma.restaurantProfile.upsert({
      where: { businessId: restaurant.id },
      update: {},
      create: {
        businessId: restaurant.id,
        cuisineTypes: ['syrian', 'levantine'],
        averagePreparationMinutes: 20,
        acceptsOnlinePayment: true,
        minimumOrderMinor: 5_000,
      },
    });
    await ensureSubscription(restaurant.id, 'restaurant_monthly', 500);

    const menuCategory = await prisma.menuCategory.create({
      data: {
        restaurantId: restaurant.id,
        nameEn: 'Main Dishes',
        nameAr: 'الأطباق الرئيسية',
        position: 0,
      },
    });
    await prisma.menuItem.create({
      data: {
        restaurantId: restaurant.id,
        menuCategoryId: menuCategory.id,
        nameEn: 'Shawarma Plate',
        nameAr: 'طبق شاورما',
        description: 'Chicken shawarma with pickles and fries',
        priceMinor: 85_000,
        preparationMinutes: 15,
        position: 0,
      },
    });
  }

  const deliveryOwnerId = userIds.get('+963941000004');
  if (deliveryOwnerId) {
    const company = await prisma.business.upsert({
      where: { id: await findBusinessIdByOwner(deliveryOwnerId, 'delivery_company') },
      update: {},
      create: {
        ownerId: deliveryOwnerId,
        type: 'delivery_company',
        name: 'Damazon Delivery Network',
        description: 'Last mile delivery fleet for Damascus',
        phone: '+963941000004',
        addressLine: 'Industrial Zone, Damascus',
        latitude: 33.49,
        longitude: 36.3,
        cityId: damascus.id,
        status: 'ACTIVE',
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
    });
    const deliveryCompany = await prisma.deliveryCompany.upsert({
      where: { businessId: company.id },
      update: {},
      create: {
        businessId: company.id,
        coverageCityIds: [damascus.id],
        maxActiveDrivers: 50,
        isOperational: true,
      },
    });
    await ensureSubscription(company.id, 'delivery_company_monthly', 500);

    const driverUserId = userIds.get('+963941000005');
    if (driverUserId) {
      await prisma.driver.upsert({
        where: { userId: driverUserId },
        update: {},
        create: {
          userId: driverUserId,
          companyId: deliveryCompany.id,
          vehicleType: 'motorcycle',
          vehiclePlateNumber: 'SY-1234',
          status: 'available',
        },
      });
    }
  }

  console.log('Seeded merchant, restaurant and delivery company with catalog and fleet');
}

async function findBusinessIdByOwner(
  ownerId: string,
  type: 'merchant' | 'restaurant' | 'delivery_company',
): Promise<string> {
  const existing = await prisma.business.findFirst({
    where: { ownerId, type },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }
  const placeholder = await prisma.business.create({
    data: {
      ownerId,
      type,
      name: `Seeded ${type}`,
      phone: '+963900000000',
      status: 'DRAFT',
      verificationStatus: 'PENDING',
    },
    select: { id: true },
  });
  return placeholder.id;
}

async function ensureSubscription(
  businessId: string,
  plan: 'merchant_monthly' | 'restaurant_monthly' | 'delivery_company_monthly',
  amountMinor: number,
): Promise<void> {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const existing = await prisma.businessSubscription.findFirst({
    where: { businessId, plan, status: { in: ['pending', 'active', 'past_due', 'grace_period'] } },
    select: { id: true },
  });
  if (existing) {
    return;
  }
  await prisma.businessSubscription.create({
    data: {
      businessId,
      plan,
      status: 'active',
      amountMinor,
      currency: 'SYP',
      periodStart: now,
      periodEnd,
      autoRenew: false,
    },
  });
}

async function seedCustomerZone(userIds: ReadonlyMap<string, string>): Promise<void> {
  const customerId = userIds.get('+963941000001');
  if (!customerId) {
    return;
  }
  const existing = await prisma.damazonZone.findFirst({ where: { ownerId: customerId } });
  if (existing) {
    return;
  }
  await prisma.damazonZone.create({
    data: {
      ownerId: customerId,
      name: 'Home',
      description: 'Default home delivery zone',
      instructions: 'Ring the bell on the second floor',
      type: 'personal',
      latitude: 33.5138,
      longitude: 36.2765,
      radiusMeters: 150,
      precisionLevel: 'exact',
      availability: 'always',
      isDefault: true,
    },
  });
  console.log('Seeded a default Damazon Zone for the customer account');
}

async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env);
  const referenceOnly = process.argv.includes('--reference-only');
  if (environment.NODE_ENV === 'production' && !referenceOnly) {
    throw new Error('Refusing to seed production with demo accounts and credentials');
  }

  await seedGeography();
  await seedCatalog();
  if (referenceOnly) {
    console.log(
      'Reference data seed complete; no users, businesses, or demo credentials were created.',
    );
    return;
  }

  await seedSettings();
  const configuration = buildConfiguration(environment);
  const passwordService = new PasswordService(configuration);
  const passwordHash = await passwordService.hash(SEED_PASSWORD);

  const userIds = await seedUsers(passwordHash);
  await seedBusinesses(userIds);
  await seedCustomerZone(userIds);

  console.log(`Seed complete. Every test account uses the password: ${SEED_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
