"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BANK_CURRENCIES, BANK_FIELDS } from "@/lib/bank";

const PROFILE_ID = "default";

const str = () => z.string().trim().optional();

const ProfileSchema = z.object({
  legalName: str(),
  address: str(),
  gstin: str(),
  country: str(),
  phone: str(),
  email: str(),
  website: str(),
  logoData: str(),
  signatureName: str(),
  footerNote: str(),
});

// The single company-profile row, created empty on first read.
export async function getCompanyProfile() {
  await requireUser();
  return prisma.companyProfile.upsert({
    where: { id: PROFILE_ID },
    update: {},
    create: { id: PROFILE_ID },
  });
}

// Bank accounts keyed by currency, for prefilling the settings form.
export async function getBankAccounts(): Promise<Record<string, {
  bankName: string | null; accountName: string | null; accountNo: string | null;
  swift: string | null; ifsc: string | null; iban: string | null;
  branch: string | null; bankAddress: string | null;
}>> {
  await requireUser();
  const rows = await prisma.bankAccount.findMany();
  const map: Record<string, ReturnType<typeof pick>> = {};
  for (const r of rows) map[r.currency] = pick(r);
  return map;
}

function pick(r: {
  bankName: string | null; accountName: string | null; accountNo: string | null;
  swift: string | null; ifsc: string | null; iban: string | null;
  branch: string | null; bankAddress: string | null;
}) {
  return {
    bankName: r.bankName, accountName: r.accountName, accountNo: r.accountNo,
    swift: r.swift, ifsc: r.ifsc, iban: r.iban, branch: r.branch, bankAddress: r.bankAddress,
  };
}

export async function saveCompanyProfile(formData: FormData) {
  await requireUser();
  const r = ProfileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Invalid input" };
  const d = r.data;
  const clean = Object.fromEntries(
    Object.entries(d).map(([k, v]) => [k, v && v.length ? v : null]),
  );
  // Default GST rate is numeric — parse separately (blank clears it).
  const rawRate = (formData.get("defaultGstRate") as string | null)?.trim();
  const parsedRate = rawRate ? Number(rawRate) : NaN;
  const defaultGstRate = rawRate && !isNaN(parsedRate) && parsedRate >= 0 ? parsedRate : null;

  await prisma.companyProfile.upsert({
    where: { id: PROFILE_ID },
    update: { ...clean, defaultGstRate },
    create: { id: PROFILE_ID, ...clean, defaultGstRate },
  });

  // Per-currency bank accounts. Fields arrive namespaced as bank_<CUR>_<field>.
  for (const cur of BANK_CURRENCIES) {
    const data: Record<string, string | null> = {};
    let anyValue = false;
    for (const f of BANK_FIELDS) {
      const raw = (formData.get(`bank_${cur}_${f}`) as string | null)?.trim() || null;
      data[f] = raw;
      if (raw) anyValue = true;
    }
    const existing = await prisma.bankAccount.findUnique({ where: { currency: cur } });
    if (anyValue) {
      await prisma.bankAccount.upsert({
        where: { currency: cur },
        update: data,
        create: { currency: cur, ...data },
      });
    } else if (existing) {
      // Cleared out — remove the account for this currency.
      await prisma.bankAccount.delete({ where: { currency: cur } });
    }
  }

  revalidatePath("/settings/company");
  return { ok: true };
}
