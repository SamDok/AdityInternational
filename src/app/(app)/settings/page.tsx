import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireUser();
  const isOwner = me.role === "owner";

  const teammates = isOwner
    ? await prisma.user.findMany({
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, email: true, role: true },
      })
    : [];

  return (
    <div>
      <PageHeader title="Settings" backHref="/" />
      <SettingsClient me={me} teammates={teammates} isOwner={isOwner} />
    </div>
  );
}
