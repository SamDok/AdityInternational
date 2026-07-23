import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding sample data…");

  // Clear existing data (safe for dev only).
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();

  const classic = await prisma.customer.create({
    data: {
      name: "Classic Textile",
      company: "Classic Textile Co.",
      email: "orders@classictextile.example",
      phone: "+1 212 555 0110",
      country: "USA",
      currency: "USD",
      address: "240 W 37th St, New York, NY",
    },
  });

  const meridian = await prisma.customer.create({
    data: {
      name: "Meridian Fabrics",
      company: "Meridian Fabrics GmbH",
      country: "Germany",
      currency: "EUR",
      phone: "+49 30 5550 220",
    },
  });

  await prisma.customer.create({
    data: { name: "Rajesh Textiles", country: "India", currency: "INR", phone: "+91 98200 11223" },
  });

  const twill = await prisma.product.create({
    data: { name: 'Cotton Twill 60"', sku: "CT-60", unit: "mtr", currency: "USD", stockQty: 4200, description: "Mid-weight cotton twill" },
  });

  const poplin = await prisma.product.create({
    data: { name: 'Poplin 44"', sku: "PP-44", unit: "mtr", currency: "USD", stockQty: 1800, description: "Fine poplin, white" },
  });

  await prisma.product.create({
    data: { name: "Linen Blend", sku: "LB-01", unit: "mtr", currency: "EUR", stockQty: 950 },
  });

  await prisma.order.create({
    data: {
      number: 1001,
      customerId: classic.id,
      status: "CONFIRMED",
      currency: "USD",
      notes: "Ship via sea freight.",
      items: {
        create: [
          { productId: twill.id, description: "Navy", quantity: 1200, unit: "mtr", rate: 3.2 },
          { productId: poplin.id, description: "White", quantity: 800, unit: "mtr", rate: 2.1 },
        ],
      },
    },
  });

  await prisma.order.create({
    data: {
      number: 1002,
      customerId: meridian.id,
      status: "IN_PRODUCTION",
      currency: "EUR",
      items: { create: [{ productId: twill.id, description: "Beige", quantity: 600, unit: "mtr", rate: 3.0 }] },
    },
  });

  console.log("Done. Seeded 3 customers, 3 products, 2 orders.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
