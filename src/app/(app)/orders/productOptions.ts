import { prisma } from "@/lib/prisma";

// Map of customerId -> { productId -> agreed price }, for prefilling order lines.
export async function getPricesByCustomer(): Promise<Record<string, Record<string, number>>> {
  const rows = await prisma.customerPrice.findMany({
    select: { customerId: true, productId: true, price: true },
  });
  const map: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    (map[r.customerId] ??= {})[r.productId] = r.price;
  }
  return map;
}

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
      label: p.design
        ? `${p.design.code}${p.width ? ` · ${p.width}` : ""}${p.colour ? ` · ${p.colour}` : ""}`
        : p.name,
      group: p.design?.category.name ?? "Other",
      groupSort: p.design?.category.sortOrder ?? 999,
      unit: p.unit,
      salePrice: p.salePrice,
      costPrice: p.costPrice,
    }))
    .sort(
      (a, b) =>
        a.groupSort - b.groupSort ||
        a.group.localeCompare(b.group) ||
        a.label.localeCompare(b.label),
    )
    .map(({ groupSort: _groupSort, ...o }) => o);
}
