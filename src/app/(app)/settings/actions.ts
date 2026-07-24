"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, isOwner, destroySession, hashPassword, verifyPassword } from "@/lib/auth";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Owner-only full-database export (JSON) for backup / peace of mind.
export async function exportAllData(): Promise<{ error?: string; data?: string }> {
  await requireUser();
  if (!(await isOwner())) return { error: "Only the owner can export all data." };
  const [
    customers, customerPrices, categories, designs, products, orders, orderItems,
    vendors, jobs, jobItems, stockMovements, bankAccounts, company, users,
  ] = await Promise.all([
    prisma.customer.findMany(),
    prisma.customerPrice.findMany(),
    prisma.productCategory.findMany(),
    prisma.design.findMany(),
    prisma.product.findMany(),
    prisma.order.findMany(),
    prisma.orderItem.findMany(),
    prisma.vendor.findMany(),
    prisma.job.findMany(),
    prisma.jobItem.findMany(),
    prisma.stockMovement.findMany(),
    prisma.bankAccount.findMany(),
    prisma.companyProfile.findMany(),
    prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true } }),
  ]);
  const dump = {
    exportedAt: new Date().toISOString(),
    customers, customerPrices, categories, designs, products, orders, orderItems,
    vendors, jobs, jobItems, stockMovements, bankAccounts, company, users,
  };
  return { data: JSON.stringify(dump, null, 2) };
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function addTeammate(_prev: unknown, formData: FormData) {
  const me = await requireUser();
  if (me.role !== "owner") return { error: "Only the owner can add teammates." };

  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter an email and a password." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Someone already uses that email." };

  await prisma.user.create({
    data: { name: name || null, email, passwordHash: hashPassword(password), role: "member" },
  });

  revalidatePath("/settings");
  return { ok: `Added ${email}. Share the password with them so they can sign in.` };
}

export async function removeTeammate(userId: string) {
  const me = await requireUser();
  if (me.role !== "owner") return { error: "Only the owner can remove teammates." };
  if (userId === me.id) return { error: "You can't remove yourself." };

  await prisma.user.delete({ where: { id: userId } }); // sessions cascade
  revalidatePath("/settings");
}

export async function changePassword(_prev: unknown, formData: FormData) {
  const me = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");

  if (next.length < 8) return { error: "New password must be at least 8 characters." };

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user || !verifyPassword(current, user.passwordHash)) {
    return { error: "Your current password is incorrect." };
  }

  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: hashPassword(next) } });
  return { ok: "Password updated." };
}
