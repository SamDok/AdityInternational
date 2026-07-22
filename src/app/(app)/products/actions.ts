"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const ProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  sku: z.string().trim().optional(),
  description: z.string().trim().optional(),
  unit: z.string().trim().min(1).default("mtr"),
  salePrice: z.coerce.number().min(0).default(0),
  currency: z.string().trim().min(1).default("INR"),
  stockQty: z.coerce.number().default(0),
});

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return ProductSchema.safeParse(raw);
}

export async function createProduct(formData: FormData) {
  const result = parse(formData);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = result.data;
  await prisma.product.create({
    data: {
      name: d.name,
      sku: d.sku || null,
      description: d.description || null,
      unit: d.unit,
      salePrice: d.salePrice,
      currency: d.currency,
      stockQty: d.stockQty,
    },
  });
  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(id: string, formData: FormData) {
  const result = parse(formData);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = result.data;
  await prisma.product.update({
    where: { id },
    data: {
      name: d.name,
      sku: d.sku || null,
      description: d.description || null,
      unit: d.unit,
      salePrice: d.salePrice,
      currency: d.currency,
      stockQty: d.stockQty,
    },
  });
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}`);
}

export async function deleteProduct(id: string) {
  const itemCount = await prisma.orderItem.count({ where: { productId: id } });
  if (itemCount > 0) {
    return { error: "This product is used in orders and can't be deleted." };
  }
  await prisma.product.delete({ where: { id } });
  revalidatePath("/products");
  redirect("/products");
}
