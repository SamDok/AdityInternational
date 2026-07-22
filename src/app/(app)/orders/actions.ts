"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/format";

const ItemSchema = z.object({
  productId: z.string().min(1),
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().min(0),
  unit: z.string().min(1),
  rate: z.coerce.number().min(0),
});

const OrderSchema = z.object({
  customerId: z.string().min(1, "Please choose a customer"),
  currency: z.string().min(1).default("INR"),
  status: z.enum(ORDER_STATUSES).default("DRAFT"),
  orderDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(ItemSchema).min(1, "Add at least one product line"),
});

export type OrderInput = z.input<typeof OrderSchema>;

function toDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

async function nextOrderNumber(): Promise<number> {
  const last = await prisma.order.findFirst({ orderBy: { number: "desc" } });
  return last ? last.number + 1 : 1001;
}

export async function createOrder(input: OrderInput) {
  const parsed = OrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }
  const d = parsed.data;
  const number = await nextOrderNumber();

  const order = await prisma.order.create({
    data: {
      number,
      customerId: d.customerId,
      currency: d.currency,
      status: d.status,
      orderDate: toDate(d.orderDate) ?? new Date(),
      dueDate: toDate(d.dueDate) ?? null,
      notes: d.notes || null,
      items: {
        create: d.items.map((it) => ({
          productId: it.productId,
          description: it.description || null,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
        })),
      },
    },
  });

  revalidatePath("/orders");
  revalidatePath("/");
  redirect(`/orders/${order.id}`);
}

export async function updateOrder(id: string, input: OrderInput) {
  const parsed = OrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }
  const d = parsed.data;

  // Replace line items wholesale (simplest, reliable for a small order).
  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId: id } }),
    prisma.order.update({
      where: { id },
      data: {
        customerId: d.customerId,
        currency: d.currency,
        status: d.status,
        orderDate: toDate(d.orderDate) ?? undefined,
        dueDate: toDate(d.dueDate) ?? null,
        notes: d.notes || null,
        items: {
          create: d.items.map((it) => ({
            productId: it.productId,
            description: it.description || null,
            quantity: it.quantity,
            unit: it.unit,
            rate: it.rate,
          })),
        },
      },
    }),
  ]);

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
  redirect(`/orders/${id}`);
}

export async function updateOrderStatus(id: string, status: string) {
  if (!ORDER_STATUSES.includes(status as never)) {
    return { error: "Unknown status" };
  }
  await prisma.order.update({ where: { id }, data: { status } });
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
}

export async function deleteOrder(id: string) {
  await prisma.order.delete({ where: { id } }); // items cascade
  revalidatePath("/orders");
  revalidatePath("/");
  redirect("/orders");
}
