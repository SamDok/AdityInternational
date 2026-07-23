import { prisma } from "@/lib/prisma";

// Product (width-variant) options for the order form, labelled by design code
// and width, and grouped by product type. Legacy variants with no design fall
// under "Other".
export async function getProductOptions() {
  const rows = await prisma.product.findMany({
    where: { archived: false },
    include: { design: { include: { category: true } } },
  });

  return rows
    .map((p) => ({
      id: p.id,
      label: p.design ? `${p.design.code}${p.width ? ` · ${p.width}` : ""}` : p.name,
      group: p.design?.category.name ?? "Other",
      groupSort: p.design?.category.sortOrder ?? 999,
      unit: p.unit,
      salePrice: p.salePrice,
    }))
    .sort(
      (a, b) =>
        a.groupSort - b.groupSort ||
        a.group.localeCompare(b.group) ||
        a.label.localeCompare(b.label),
    )
    .map(({ groupSort: _groupSort, ...o }) => o);
}
