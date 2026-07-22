# Aditya International ERP

A clean, mobile-first ERP for running the business — customers, products, and
orders — from **any computer or phone**. It's a web app: open it in a browser on
any device, and on a phone you can **install it to your home screen** (PWA) so it
feels like a native app. One system, one login, your data everywhere.

Built to be simple enough that anyone on the team can use it without training.

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** for a consistent, touch-friendly UI
- **Prisma** ORM — SQLite for local development, Postgres for production
- Server Actions for data changes (no separate API layer to maintain)

## Getting started (local)

```bash
npm install            # install dependencies
npm run db:push        # create the local SQLite database
npm run db:seed        # add sample customers, products, and orders
npm run dev            # start on http://localhost:3000
```

Open http://localhost:3000 on your computer, or on your phone using your
computer's IP address on the same network.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app in development mode |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run db:push` | Sync the database to the schema |
| `npm run db:seed` | Load sample data |
| `npm run db:reset` | Wipe and re-seed (dev only) |

## Project structure

```
prisma/
  schema.prisma      # data model: Customer, Product, Order, OrderItem
  seed.ts            # sample data
src/
  app/               # pages (Next.js App Router)
    page.tsx         # home dashboard
    customers/       # customers module (list, add, view, edit)
    products/        # products module (list, add, view, edit)
    orders/          # orders (view — creation coming next)
  components/         # shared UI (nav, header, icons, buttons)
  lib/               # prisma client + formatting helpers
```

## What works today

- **Login** — individual accounts (email + password). The first account created is
  the owner; the owner adds teammates from Settings. Every page is private.
- **Home dashboard** — counts and recent orders at a glance
- **Customers** — add, view, edit, delete; per-customer currency and order history
- **Products** — add, view, edit, delete; price, unit, and stock on hand
- **Orders** — create and edit with product lines, live totals, multi-currency,
  and a one-tap status flow (Draft → Confirmed → In production → Shipped → Completed)
- **Settings** — change your password, add/remove teammates (owner only)
- **Installable** on phones (PWA) and fully responsive

## Backlog

Ideas we've discussed but deferred — each with where and how to build it — live
in [`docs/BACKLOG.md`](docs/BACKLOG.md).

## Roadmap

1. ✅ Foundation + Customers + Products
2. ✅ Sales order entry (add lines, pick products, live totals, multi-currency)
3. ✅ Login & individual accounts (owner + teammates)
4. Deploy so it's live on every device (hosted database + hosting)
5. Inventory movements & per-customer price lists
6. Invoicing & payment tracking (receivables)
7. Dashboard & reports (sales by month, top customers, stock alerts)
8. Optional: accounting export / sync (e.g. to Tally) if needed later

## Deploying (so it's live for everyone)

The app runs anywhere Node runs. The simplest path:

1. Create a hosted Postgres database (e.g. Neon, Supabase, or Railway).
2. In `prisma/schema.prisma`, change `provider = "sqlite"` to `"postgresql"`.
3. Set `DATABASE_URL` to your Postgres connection string.
4. Deploy to a host like Vercel (connect the repo, add the env var, deploy).

Once deployed, everyone opens the same URL and shares the same live data.

## Security note

The earlier prototype committed an Asana token and an API key in plaintext.
**Those should be rotated/revoked.** This app keeps all secrets in environment
variables (`.env`, which is never committed).
