"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const PROFILE_ID = "default";

const str = () => z.string().trim().optional();

const ProfileSchema = z.object({
  legalName: str(),
  address: str(),
  gstin: str(),
  phone: str(),
  email: str(),
  website: str(),
  logoData: str(),
  bankName: str(),
  bankAccountName: str(),
  bankAccountNo: str(),
  bankSwift: str(),
  bankIfsc: str(),
  bankBranch: str(),
  signatureName: str(),
  footerNote: str(),
});

// The single company-profile row, created empty on first read.
export async function getCompanyProfile() {
  return prisma.companyProfile.upsert({
    where: { id: PROFILE_ID },
    update: {},
    create: { id: PROFILE_ID },
  });
}

export async function saveCompanyProfile(formData: FormData) {
  await requireUser();
  const r = ProfileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Invalid input" };
  const d = r.data;
  const clean = Object.fromEntries(
    Object.entries(d).map(([k, v]) => [k, v && v.length ? v : null]),
  );
  await prisma.companyProfile.upsert({
    where: { id: PROFILE_ID },
    update: clean,
    create: { id: PROFILE_ID, ...clean },
  });
  revalidatePath("/settings/company");
  return { ok: true };
}
