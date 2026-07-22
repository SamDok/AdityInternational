"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, createSession, hasNoUsers } from "@/lib/auth";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function login(_prev: unknown, formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Wrong email or password." };
  }

  await createSession(user.id);
  redirect("/");
}

// Creates the very first account (the owner). Only allowed when no users exist,
// so this can't be used to sign up strangers once the business is set up.
export async function registerFirstOwner(_prev: unknown, formData: FormData) {
  if (!(await hasNoUsers())) {
    return { error: "An account already exists. Please sign in." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please enter an email and password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const user = await prisma.user.create({
    data: { name: name || null, email, passwordHash: hashPassword(password), role: "owner" },
  });

  await createSession(user.id);
  redirect("/");
}
