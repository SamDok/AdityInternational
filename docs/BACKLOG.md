# Aditya ERP — Backlog & Deferred Ideas

This is the running list of things we've discussed but **not yet built**. Each
item says *what* it is, *why* it matters, *where* to implement it (real file
paths), and a suggested *approach*, so it can be picked up later without
re-deriving the plan.

**How to use this file**
- When we defer an idea, add it here with a file-path pointer.
- When we build one, delete it from here (git history keeps the record) and note
  it in `README.md`'s "What works today".
- Reminder on data changes: schema lives in `prisma/schema.prisma`; every schema
  change needs a new numbered folder in `prisma/migrations/` (nullable columns
  only, so live data is safe). Migrations apply automatically on deploy via the
  `vercel-build` script.

Priority key: 🔴 essential soon · 🟡 strong improvement · 🟢 nice-to-have / big.

---

## Customers

### 🔴 Export customers to CSV/Excel
**Why:** We can import but not export — you should be able to get your own data
out (backups, reporting, sharing). Avoids lock-in.
**Where:** `src/app/(app)/customers/actions.ts` (a server action that returns
rows) + a "Export" button next to "Import" in the header of
`src/app/(app)/customers/page.tsx`. Reuse the current filter/search `where`
clause so "export what I'm looking at" works.
**Approach:** build a CSV string server-side (or client-side from fetched rows),
trigger a download via a Blob (same technique as the template download in
`src/app/(app)/customers/import/ImportClient.tsx`).
**Effort:** small.

### 🔴 Pagination / lazy loading (before ~500 customers)
**Why:** The list currently loads *every* customer at once. Fine for now, slow
once there are hundreds.
**Where:** `src/app/(app)/customers/page.tsx` — add `take`/`skip` with a `page`
search param, or cursor-based "load more". Same pattern will apply to Products
and Orders lists.
**Effort:** medium.

### 🟡 Activity log / interaction timeline
**Why:** `notes` is a single box. A dated log of calls, emails, and meetings per
customer is a light CRM that helps the team remember context.
**Where:** new `CustomerNote` model in `prisma/schema.prisma`
(`id, customerId, userId, body, createdAt`) + migration; a timeline section on
`src/app/(app)/customers/[id]/page.tsx` with an "Add note" action in
`src/app/(app)/customers/actions.ts`.
**Effort:** medium.

### 🟢 Multiple contacts per customer
**Why:** A company often has several people (sales contact, accounts contact),
each with their own phone/email. Today there's one `contactPerson`.
**Where:** new `Contact` model (`customerId, name, role, email, phone`) +
migration; a "Contacts" section on the customer detail/edit pages.
**Effort:** medium.

### 🟢 Multiple ship-to / consignee addresses
**Why:** Exporters often ship one customer's goods to several consignees. Today
there's a single `shippingAddress`.
**Where:** new `ShippingAddress` model (`customerId, label, address,
destinationPort, ...`) + migration; a picker on the order form
(`src/app/(app)/orders/OrderForm.tsx`) to choose which ship-to for an order.
**Effort:** medium–large (touches orders too).

### 🟢 Attachments / documents
**Why:** Store the customer's agreement, KYC, GST certificate, etc.
**Where:** needs file storage (e.g. an object store / S3-compatible bucket, since
the app filesystem is ephemeral). New `Attachment` model + upload UI on the
detail page. **Blocked on** choosing a storage provider.
**Effort:** large (infra decision required).

### 🟡 Tags / labels
**Why:** `category` is a single value. Free-form tags ("VIP", "slow payer",
"sampling") allow flexible grouping and filtering.
**Where:** simplest first version — a `tags String[]` (Postgres array) on
`Customer` + a tag input on the form + a tag filter in `CustomerFilters.tsx`.
**Effort:** small–medium.

### 🟡 Smarter duplicate detection
**Why:** We block exact-name duplicates, but "Classic Textile" vs "Classic
Textiles" slips through, and duplicate GST/tax IDs aren't caught.
**Where:** `nameTaken()` / create+import paths in
`src/app/(app)/customers/actions.ts`. Add a warning (not hard block) on close
matches and on duplicate `gstin`/`taxId`.
**Effort:** medium.

### 🟢 Customer merge
**Why:** When duplicates do happen, merge two records (and move their orders)
into one.
**Where:** a server action that re-points `Order.customerId` and copies missing
fields, then deletes the loser. UI on the detail page.
**Effort:** medium.

### 🟡 Audit trail (created-by / updated-by)
**Why:** In a team, it helps to know who added or last changed a customer.
**Where:** add `createdById` / `updatedById` (relations to `User`) on `Customer`
+ migration; set them in the create/update actions using `getCurrentUser()`
(`src/lib/auth.ts`); show on the detail page.
**Effort:** small–medium.

### 🟢 Structured address + map links
**Why:** One free-text address blob can't be filtered by city/state or opened in
Maps.
**Where:** optional `city`, `state`, `postalCode` columns on `Customer`; a
tap-to-open Maps link on the detail page. Weigh against added form length.
**Effort:** medium.

---

## Products & pricing

Per-customer price lists and colour-per-width are **built**. Follow-ups:
- **🟡 Save a typed order rate as the customer's price.** On the order form,
  when a rate is entered for a customer+variant, offer a one-tap "save as this
  customer's price" (upsert via `setCustomerPrice` in
  `src/app/(app)/customers/actions.ts`).
- **🟢 Price history / effective dates.** Keep past prices instead of
  overwriting on the `CustomerPrice` upsert.
- **🟢 Colour-based reporting** (cost/margin by colour) on the Reports page,
  which now exists (`src/app/(app)/reports/page.tsx`).
- Product CSV import/export, images, low-stock alerts, bulk-width entry,
  duplicate-design, quick stock adjust, catalogue filters and a searchable order
  picker are **built**. Remaining:
  - **🟡 Object storage for images** (beyond base64-in-DB) — now more pressing at
    ~2000+ designs: photos live as base64 in `Design.imageData`. The visual
    gallery already avoids the payload blow-up by serving thumbnails from
    `/designs/[designId]/image` (lazy-loaded, capped + server-searched), but the
    bytes still sit in the main DB row. Move `imageData` to an uploaded URL + a
    storage bucket so design reads stay light and images get CDN caching.
  - **🟡 Server-side product typeahead for the order form.** `getProductOptions`
    ships **every** width-variant to the order form (fine for hundreds, heavy at
    2000+ designs × widths). Swap `ProductPicker` for a debounced server search
    (query → top matches) like the design gallery now does, so the form payload
    stays small regardless of catalogue size.
  - The catalogue-wide **recent stock movements** feed is now built
    (`src/app/(app)/products/movements/page.tsx`, powered by the `StockMovement`
    log, including the new `CUSTOMER_RETURN` / `VENDOR_REJECT` reasons). A
    **🟢 per-variant stock report** (opening/closing over a date range) would
    round it out.
  - **🟢 Reserve stock on Confirmed** — stock now leaves **per shipment**
    (`recordShipment` in `src/app/(app)/orders/actions.ts`). If the workflow ever
    needs soft allocation, add a "reserved" concept that holds stock from Confirmed
    and converts to a true deduction when a shipment is recorded.
- Note: the order form loads a `pricesByCustomer` map
  (`orders/productOptions.ts`); move it to an on-demand fetch if it grows large.

## Ties to future modules (parked until that module exists)

The **Money** (receivables + payables, `src/lib/money.ts`, `src/app/(app)/money/`),
**Reports** (`src/app/(app)/reports/page.tsx`), **GST/invoice** (`src/lib/tax.ts`,
`src/lib/words.ts`, discount + freight/insurance + FX + export-doc fields on the
commercial invoice), and **returns/QC/short-close** (`recordReturn`,
`recordRejection`, `closeJobShort`) phases are now **built**. Also built:
outstanding balance + a soft credit-limit warning, auto-applied `defaultDiscount`,
vendor payables/ledger, the named-dispatch Shipment with packing list &
commercial invoice, and the catalogue-wide stock-movements feed
(`src/app/(app)/products/movements/page.tsx`). Remaining follow-ups:

- **🟡 Hard credit-limit block at order creation.** Today the customer page only
  *warns* when outstanding exceeds `creditLimit`. Optionally block (or require
  override) when a new **order/shipment** would push them over — guard in
  `createOrder` / `createShipment`.
- **🟢 Regenerate granularity** — `generateProcurement` tops up only the
  uncovered shortfall (idempotent), but there's no UI to edit an auto-job before
  it's saved or to split a group across vendors; both are manual for now.
- **🟡 Finer shipment correction** — a full "reduce a shipment line by N" as a
  gentler alternative to `cancelShipment`; `recordReturn` covers the goods-back
  case, but a plain quantity correction (no stock return) is still manual.
- **🟢 Push job cost into `Product.costPrice`** (making charge + base material),
  so margins use real landed cost instead of the standing cost price.
- **🟢 Base material issued to a kaarigar** (material out) if you want to track
  the fabric you hand over.

### 🟡 Ranked reports (top customers / top designs)
**Why:** The Reports dashboard shows per-currency totals but no rankings.
**Where:** `src/app/(app)/reports/page.tsx`. Held back because ranking sales
**across currencies** is misleading without a common unit — do it once an FX/base-
currency conversion exists (see below), or rank **within** each currency.
**Effort:** small once the currency question is settled.

### 🟢 Salesperson performance
With orders + invoicing in place, report sales grouped by `salespersonId` on the
Reports page. **Effort:** small–medium.

---

## Money & trade documents (deferred from the invoicing/returns work)

### 🟡 FX-based cross-currency margin & a base currency
**Why:** Order margin (`src/app/(app)/orders/[id]/page.tsx`) only shows a blended
%/amount when cost and sale are the **same currency**; export orders (INR cost,
USD/EUR sale) show cost and revenue side by side but no margin. The shipment now
carries an `fxRate` — wire it (and/or a company base currency) so export margins,
and cross-currency report/ranking totals, can be expressed in one unit.
**Where:** margin block in the order page; `src/lib/money.ts`; Reports page.
**Effort:** medium.

### 🟡 Formal credit note for returns
**Why:** `recordReturn` reduces the invoice value directly (fine for a business
this size). Some buyers require a **numbered credit note** document instead.
**Where:** a `CreditNote` model + FY numbering (mirror `shipmentDocNo` in
`src/lib/jobNumber.ts`) + a print page like `src/app/invoice/[shipmentId]`.
**Effort:** medium.

### 🟢 Real e-invoice (IRN) / e-way-bill generation
**Why:** We **store and print** `eInvoiceIrn` / `ewayBillNo` (entered by hand),
but don't generate them. Full compliance means calling a GSP/IRP API to mint the
IRN + signed QR and the e-way bill.
**Where:** a server integration + fields already on `Shipment`. **Blocked on**
choosing a GSP provider and credentials. **Effort:** large (external integration).

### 🟢 Trade-document attachments
**Why:** Attach the customer's PO, the LC copy, and the B/L / shipping-bill scans
to an **order or shipment** (the Customers section already lists KYC attachments —
same infra). **Blocked on** an object-storage provider (app FS is ephemeral).
**Where:** an `Attachment` model + upload UI on order/shipment detail.
**Effort:** large (infra decision required).

---

## Cross-cutting / platform (not customer-specific)

- **🟡 Toasts + undo.** Success/error toasts, and an "Undo" on archive/delete.
- **🟡 Role-based permissions.** Restrict destructive actions (delete, import,
  managing teammates) to owners/managers. Builds on the existing `role` field in
  `prisma/schema.prisma`.
- **🟢 Whole-database export / backup.** A one-click export of all data for the
  owner's peace of mind (beyond per-module CSV).
- **🟢 Product & Order modules deserve the same treatment** as Customers got:
  search, filters, CSV import/export, codes/SKUs, and pagination.
