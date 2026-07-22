# Deploy your ERP (step by step)

This puts your app on the internet with a link that works on every phone and
computer. You'll create two free accounts; I've done all the code setup.

**Total time: ~15 minutes. No coding.**

There are three parts:
1. A free **database** (where your data lives safely) — Neon
2. Free **hosting** (runs the app) — Vercel
3. Open your live link and create your owner account

---

## Part 1 — Create the database (Neon)

1. Go to **https://neon.tech** and click **Sign up** (use your GitHub account or email).
2. Click **Create project**. Give it a name like `aditya-erp`. Leave the defaults and create it.
3. On the project dashboard, find the **Connection string** box.
   - If there's a **"Pooled connection"** toggle, turn it **OFF** (we want the direct one).
   - Click **Copy**. It looks like:
     `postgresql://alex:AbC123@ep-cool-name.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. **Paste it somewhere safe for a minute** — you'll need it in Part 2.

That's the database done. You never have to touch it again.

---

## Part 2 — Host the app (Vercel)

1. Go to **https://vercel.com** and click **Sign up**. Choose **Continue with GitHub**
   (this is the same GitHub where your code lives).
2. Click **Add New… → Project**.
3. Find **`AdityInternational`** in the list and click **Import**.
4. Before deploying, open the **Environment Variables** section and add one:
   - **Name:** `DATABASE_URL`
   - **Value:** paste the Neon connection string from Part 1
   - Click **Add**.
5. Leave everything else on its defaults (the app is on your `main` branch,
   which Vercel deploys automatically — nothing to change).
6. Click **Deploy**. Wait ~2 minutes while it builds. ✅

When it finishes, Vercel shows a link like `https://adity-international.vercel.app`.

---

## Part 3 — Open it and create your account

1. Click your new link.
2. The first screen says **"Create your owner account"** — enter your name, email,
   and a password. That account is **you** (the owner).
3. You're in! Add your real customers, products, and orders.
4. **On your phone:** open the same link, then use the browser menu →
   **"Add to Home Screen"**. Now it opens like a real app.
5. Add your team from **Settings** (the gear on the home screen).

---

## Everyday updates

Whenever I push an improvement to your branch, Vercel **redeploys automatically** —
your live link always has the latest version. Your data stays safe in Neon across updates.

## If something goes wrong

- **Build failed on Vercel:** usually the `DATABASE_URL` is missing or has a typo.
  Open the project's **Settings → Environment Variables**, fix it, then
  **Deployments → … → Redeploy**.
- **"Can't reach database":** make sure you used the Neon string with
  `?sslmode=require` at the end, and the non-pooled (direct) one.
- Stuck? Send me the error text from the Vercel build log and I'll sort it.
