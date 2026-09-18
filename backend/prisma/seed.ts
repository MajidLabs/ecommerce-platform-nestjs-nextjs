import { PrismaClient, Role, CouponType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('Admin@12345', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
    },
  });
  await prisma.cart.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id },
  });

  const customerPassword = await bcrypt.hash('Customer@12345', 10);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      passwordHash: customerPassword,
      firstName: 'Test',
      lastName: 'Customer',
      role: Role.CUSTOMER,
    },
  });
  await prisma.cart.upsert({
    where: { userId: customer.id },
    update: {},
    create: { userId: customer.id },
  });

  const electronics = await prisma.category.upsert({
    where: { slug: 'electronics' },
    update: {},
    create: { name: 'Electronics', slug: 'electronics' },
  });
  const clothing = await prisma.category.upsert({
    where: { slug: 'clothing' },
    update: {},
    create: { name: 'Clothing', slug: 'clothing' },
  });

  const productsData = [
    {
      name: 'Wireless Headphones',
      slug: 'wireless-headphones',
      description: 'Noise-cancelling over-ear wireless headphones with 30 hour battery life.',
      price: 129.99,
      categoryId: electronics.id,
      stock: 50,
    },
    {
      name: 'Smart Watch',
      slug: 'smart-watch',
      description: 'Fitness tracking smart watch with heart-rate monitor.',
      price: 199.99,
      categoryId: electronics.id,
      stock: 30,
    },
    {
      name: 'Portable Speaker',
      slug: 'portable-speaker',
      description: 'Waterproof bluetooth speaker with rich bass.',
      price: 59.99,
      categoryId: electronics.id,
      stock: 4,
    },
    {
      name: 'Cotton T-Shirt',
      slug: 'cotton-t-shirt',
      description: 'Basic 100% cotton crew-neck t-shirt.',
      price: 19.99,
      categoryId: clothing.id,
      stock: 100,
    },
    {
      name: 'Denim Jacket',
      slug: 'denim-jacket',
      description: 'Classic fit denim jacket.',
      price: 79.99,
      categoryId: clothing.id,
      stock: 25,
    },
  ];

  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        categoryId: p.categoryId,
        images: [],
      },
    });
    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {},
      create: { productId: product.id, quantity: p.stock, reorderLevel: 5 },
    });
  }

  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      type: CouponType.PERCENTAGE,
      value: 10,
      minOrderAmount: 50,
      usageLimit: 100,
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Seed completed.');
  console.log('Admin login:    admin@example.com / Admin@12345');
  console.log('Customer login: customer@example.com / Customer@12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
