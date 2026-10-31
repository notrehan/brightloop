# Brightloop Subscriptions MVP

A hackathon MVP for recurring subscription operations, built with Next.js 15, TypeScript, and Supabase Auth/Postgres.

## Start locally

1. Add your Supabase Project URL and anon/publishable key to `.env.local` (or the existing `.env` file):

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   Never use the Supabase service-role key in a `NEXT_PUBLIC_` variable.

2. In Supabase Dashboard → SQL Editor, open `supabase/setup_mvp.sql`, review the warning at the top, and run the whole script once. It installs the Brightloop schema, row-level security, account-provisioning trigger, recurring billing/payment functions, and demo data. It intentionally resets the app's named tables. It keeps Supabase Auth users and Storage objects; existing Auth users are linked automatically, with the most recently active account becoming admin.

3. In Supabase Authentication → URL Configuration, allow `http://localhost:3000/auth/callback` as a redirect URL. If email confirmation is enabled, confirm signup from the link before signing in.

4. Run:

   ```bash
   npm install
   npm run dev
   ```

5. Open http://localhost:3000/login. The first account created in a clean Supabase project becomes the workspace admin. Additional signups become customer portal accounts. There is no separate workspace setup form.

## MVP features

- Supabase signup, login, email confirmation callback, password reset, and session refresh.
- Admin dashboard with database-backed MRR, customer/subscription/invoice/payment counts, plan mix, activity, and upcoming renewals.
- Product catalog with create, edit, archive/restore, product type, category, reference/barcode, sale/purchase flags, product image uploads, and recurring billing setup. New recurring products automatically create their first linked pricing plan.
- Customer records and pricing plan creation.
- Subscription creation, pause, resume, and cancellation.
- Idempotent “Run billing cycle” action to create recurring invoices.
- Simulated successful/failed payments, with invoice and subscription status updates and retry actions.
- Customer portal with plan selection, subscription controls, invoices, and payment history.
- INR prices are stored as integer paise. Every payment shown is simulated; no payment gateway is connected.

## Demo data and first account

The SQL script seeds the Brightloop business, Starter/Pro/Business plans, eight demo customer records, twelve subscriptions, invoices, payment attempts, and activity events. Use a normal signup for the admin. If the Supabase project already has Auth users, the SQL script automatically attaches them to the seeded business: the most recently signed-in user is the admin and the rest are customer portal users.


If you already installed the MVP schema, run `supabase/products_section.sql` once in Supabase SQL Editor before opening Products. It adds fields and the product image bucket without deleting current products or subscriptions. For a clean database, the full setup script already includes these fields.
