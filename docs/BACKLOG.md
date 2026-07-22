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

### 🟡 Phone country codes (make international numbers easy)
**Why:** This is an export business — most numbers are international. Without a
country code, WhatsApp links (`wa.me`) are unreliable and numbers are ambiguous.
**Easy logic (no extra typing for the user):**
- Add `src/lib/dialCodes.ts` — a map of country name → dial code
  (e.g. `{ "Germany": "+49", "United States": "+1", "India": "+91", ... }`),
  keyed to the same country names already in `src/lib/countries.ts`.
- In `src/app/(app)/customers/CustomerForm.tsx`, the country is already tracked
  in state (`country`). When it changes, if **Phone** (or **Alt phone**) is
  empty, prefill it with the dial code + a space (e.g. `"+49 "`). Never overwrite
  a number the user already started — only prefill blanks.
- Result: pick "Germany" → phone shows `+49 ` → user types the local part.
- Bonus: this makes the existing `wa.me/<digits>` link on the detail page
  (`src/app/(app)/customers/[id]/page.tsx`) work correctly worldwide.
**Optional upgrade:** a small dial-code `<select>` glued to the left of the phone
input for manual override, defaulting from the country.
**Effort:** small. No schema change (phone stays a single string field).

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

### 🟡 List: sorting + "last order" recency
**Why:** Right now the list only sorts A–Z. Sorting by most recent, most orders,
or credit exposure — and showing each customer's **last order date** — makes it
easy to spot your best and your dormant customers.
**Where:** `src/app/(app)/customers/page.tsx` (add a `sort` search param to the
`orderBy`), `src/app/(app)/customers/CustomerFilters.tsx` (a sort dropdown).
For last-order date, include `orders: { orderBy: { orderDate: "desc" }, take: 1 }`
in the query and show it in the row.
**Effort:** small–medium.

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

## Ties to future modules (parked until that module exists)

### 🔴 Credit-limit enforcement & outstanding balance
`creditLimit` and `defaultDiscount` are **stored and displayed** but not yet
*acted on*. When invoicing/payments exist: compute each customer's outstanding
balance, warn when a new order would exceed their credit limit, and auto-apply
`defaultDiscount` to new order lines. Belongs with the **Invoicing** phase.

### Salesperson performance
With orders + invoicing, report sales grouped by `salespersonId`. Belongs with
the **Reports** phase.

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
