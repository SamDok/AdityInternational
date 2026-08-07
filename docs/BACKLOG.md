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

### 🟢 Customer merge
**Why:** When duplicates do happen, merge two records (and move their orders)
into one.
**Where:** a server action that re-points `Order.customerId` and copies missing
fields, then deletes the loser. UI on the detail page.
**Effort:** medium.

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
  - **🟢 External object storage / CDN for images.** Photos are now in a separate
    `DesignImage` table (out of the `Design` row) and served via
    `/designs/[id]/image`, so design reads are light — but the bytes are still
    base64 in Postgres. A further step, if image volume grows, is uploading to an
    object store (S3/Blob) and serving a CDN URL, so the DB holds only a
    reference. **Blocked on** choosing a provider. Lower priority now that rows
    are lean.
  - The **order form, job form and customer price list** all use the debounced
    server typeahead (`searchProducts` + `ProductTypeahead`) — none ship the
    catalogue. The catalogue page, and the customer/job/shipment lists, paginate
    in the database. Customer prices are fetched per-customer (`getCustomerPrices`)
    on the order form, not all at once.
  - The catalogue-wide **recent stock movements** feed is built
    (`src/app/(app)/products/movements/page.tsx`, powered by the `StockMovement`
    log, including the `CUSTOMER_RETURN` / `VENDOR_REJECT` reasons), and the
    **per-variant stock report** (opening/received/issued/closing over a date
    range) is now built too (`src/app/(app)/products/stock-report/page.tsx`).
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
- **🟢 Push job cost into `Product.costPrice`** (making charge + base material) —
  *partly addressed:* actual **material cost is now folded into the order margin**
  (issued fabric, `src/app/(app)/orders/[id]/page.tsx`); pushing landed cost into
  `costPrice` itself is still optional.
- **✅ BUILT — Base material issued to a kaarigar.** The whole **Materials module**
  now covers this (catalogue, POs, per-design-line issue + reconcile). See the
  "Built in the walkthrough fixes" recap at the end of this file.

---

## Money & trade documents (deferred from the invoicing/returns work)

### 🟡 Cross-currency report totals & a base currency  *(order margin ✅ BUILT)*
**Why:** The **order margin** now converts INR cost into the sale currency using
reference FX rates (Settings → Exchange rates), so export margins show
(`src/app/(app)/orders/[id]/page.tsx`, `src/lib/fx.ts`). **Still pending:**
expressing **Reports totals / rankings across currencies** in one base currency —
they're per-currency today.
**Where:** Reports page (`src/app/(app)/reports/page.tsx`); `src/lib/money.ts`.
Reuse `getFxRates()` / `convert()` in `src/lib/fx.ts`.
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

## Scale (2000+ designs, growing history)

Most of the scale work is **done**: images moved off the design row + served via a
route; the catalogue, customer/job/shipment lists paginate in the DB; the order,
job and price-list forms use a server typeahead; per-customer price fetch. Two
places are **deliberately left live-computed**, because optimising them trades
correctness/robustness for speed on pages that aren't hot:

- **🟡 Orders list + home "open" count** filter/count on *derived* completeness
  (per-line `shippedQty` vs `quantity` + `manualComplete`), which the DB can't
  express without column-to-column comparison. To paginate/aggregate these in the
  DB they'd need a maintained `Order.complete` flag updated across ~7 write paths
  (create/edit order, ship, return, reduce, cancel-shipment, mark-complete) — real
  drift risk. They currently load the (bounded) set of non-cancelled orders and
  compute in memory. Revisit with a flag if order volume gets large.
- **🟡 Reports + Money** load transaction rows to compute totals live, because an
  invoice's grand total depends on GST/discount/charges that vary per shipment —
  a plain SQL `SUM` can't reproduce it. Denormalising a stored `Shipment.total`
  would speed these up but risks silent money drift if a write path forgets to
  recompute; kept live for correctness. These are occasional admin views, so the
  full-table read is acceptable until transaction history is very large.
- **🟢 Trigram/GIN index** on `Design.code`/`name` (and product/customer search
  columns) once you pass tens of thousands of rows — ILIKE `contains` scans are
  fine at 2000 but not at 50k+.

## Cross-cutting / platform (not customer-specific)

- **Toasts + undo — built.** Success/error toasts app-wide; one-tap **Undo** on
  archive for customers, designs and vendors (`ToggleButton` / `ArchiveButton`).
  Hard deletes stay confirm-only (nothing to restore).
- **🟡 Role-based permissions.** Restrict destructive actions (delete, import,
  managing teammates) to owners/managers. Builds on the existing `role` field in
  `prisma/schema.prisma`.
- **🟢 Whole-database export / backup.** A one-click export of all data for the
  owner's peace of mind (beyond per-module CSV).
- **🟢 Product & Order modules — mostly done.** Product CSV import/export,
  search, filters, codes/SKUs and pagination are built; **Order CSV export** is
  built (`src/app/(app)/orders/ExportButton.tsx`). Remaining: an **Order CSV
  import** (create orders in bulk from a sheet).

---

## Missing use cases — net-new modules (from the end-to-end walkthrough)

These are **whole features**, not tweaks. None are built yet. Listed so we can
decide order before starting. Priority reflects business value for an Indian
textile **export** house.

### 🔴 Export incentives — Duty Drawback / RoDTEP / GST input refund
**Why:** Zero-rated exports let you reclaim GST paid on inputs (fabric, zari) and
claim drawback/RoDTEP — often 1–5%+ of FOB. Real money, tracked nowhere.
**Where:** capture input GST (add `gstRate` to `MaterialPOItem`); a claims/refund
model tied to `Shipment`/HSN; a refund-due report on `src/app/(app)/reports`.
**Effort:** large.

### ✅ BUILT — Receivables / Payables aging + customer / vendor statements
Money page now shows **aging buckets** (0-30 / 31-60 / 61-90 / 90+) per currency
for receivables and payables (`agingByCurrency` in `src/lib/money.ts`), and there
are **printable statements of account** per customer (`/statement/customer/[id]`)
and per vendor (`/statement/vendor/[id]`) with a running-balance ledger. Vendor
figures include **material purchases** alongside job work.
Follow-up (🟢): a date-range / "as-of" filter on the statement, and PDF email-out.

### ✅ BUILT — Multi-process job work (sequential operations)
A job can be marked an **intermediate stage** (`Job.isFinalStage=false`); its
receipt becomes **work-in-progress**, not sellable stock. **"Send to next stage"**
(`addNextStage`) creates the next stage as a job to another kaarigar, carrying the
received WIP forward; only the **final** stage's receipt lands in finished stock
(`receiveJob` guards on `isFinalStage`). Stage chain fields on `Job`
(`routeId`/`stageNo`/`stageName`/`prevStageId`, migration 0036), a route strip +
WIP + "Send to next stage" on the job page, and a **Production route** timeline on
the order page. Materials are expected on the first stage only (later stages are
exempt from the awaiting-materials gate). Migration 0036.
Follow-ups (🟢): reverse-stock helper so a job can be marked intermediate *after*
receiving; per-stage material issue (currently first-stage only, by design).

### ✅ BUILT — FX gain / loss on realization
Each foreign invoice locks its booking rate (`Shipment.fxRate`, auto-filled from
the daily reference rate at creation), and each receipt captures a realization
rate (`Payment.fxRate`, prefilled and editable on the payment form). The rupee
difference on the settled amount is computed FIFO (`realizedFxGain` in
`src/lib/money.ts`) and shown as **Realized FX gain/loss** on the customer page
and as a card on Reports.
Follow-up (🟢): the same on the **payables** side (paying a foreign supplier) —
would need `VendorPayment.fxRate` + `MaterialPurchaseOrder`/`Job` booking rates.

### ✅ BUILT — Sampling workflow
An order can be flagged **`isSample`** (toggle on the order form). Samples run
through jobs/procurement normally but are kept **out of Sales, rankings and the
order-book / open-order counts** (Reports + home); a **charged** sample still
shows in receivables. The Orders list has a **Samples tab** + badge, the invoice
& proforma print a **"Sample — value for customs purposes only"** banner, and
**Convert to bulk** (`convertSampleToBulk`) clones an approved sample into a real
order and links them (`Order.sampleSource`/`bulkOrders`, `Order.sampleStatus`).
Migration 0035. Follow-up (🟢): a dedicated sample-dispatch document distinct
from the commercial invoice.

### 🟡 TDS on job-work payments + input GST credit on purchases
**Why:** Statutory — TDS (194C) when paying kaarigars; input GST credit on
material buys.
**Where:** TDS fields on `VendorPayment`; `gstRate` on `MaterialPOItem` + an
input-credit report.
**Effort:** medium.

### 🟢 LC / advance lifecycle
**Why:** Export is often on LC or advance; only flat `Payment`s exist today.
**Where:** an LC/advance model with milestones tied to order/shipment.
**Effort:** large.

### 🟢 Full export document set
**Why:** Certificate of Origin isn't generated; Shipping Bill / BL-AWB /
e-invoice IRN / e-way (fields exist on `Shipment`) aren't captured in the builder
or printed.
**Where:** shipment-builder inputs + a Certificate-of-Origin print page mirroring
`src/app/invoice/[shipmentId]`. (Real e-invoice/e-way generation already parked
above as a large GSP integration.)
**Effort:** medium (COO doc).

### 🟢 Roll / than & shade-lot tracking
**Why:** Fabric ships as numbered rolls with individual lengths; dye lots must
match across a shipment.
**Where:** a roll/piece model under `ShipmentItem` with per-roll length + lot;
packing list prints per-roll.
**Effort:** large.

### Small leftovers (from the walkthrough)
- **🟡 Hard credit-limit block/override** at order or shipment creation (a soft
  warning already exists) — guard in `createOrder` / `createShipment`.
- **🟢 Light per-design BOM** — a standard base-fabric consumption per finished
  unit, to give an **upfront material estimate on new orders** and **embellishment
  quantity planning** in procurement (owner deferred a full BOM for now).
- **🟢 Legacy jobs show `#1`** (records predating FY numbering) — cosmetic backfill.

### ✅ Built in the walkthrough fixes — listed here for verification
- **Export margin via reference FX rates** — Settings → Exchange rates; the order
  margin converts INR making+material cost into the sale currency (`src/lib/fx.ts`,
  `src/app/(app)/orders/[id]/page.tsx`).
- **Material-PO liabilities** now included in Reports "To pay" + the Money page.
- **Domestic-GSTIN nudge** on INR orders whose customer has no GSTIN.
- **Materials module** (whole): raw-material catalogue + stock ledger, material
  purchase orders + receive + print, per-design-line **issue + reconcile**
  (issued/returned/used), default materials per fabric-type and per design,
  **Materials at cost** in Reports, base-fabric **procurement planner**, and the
  **"awaiting materials" gate** across the Production list, Due-soon board and job
  page.
