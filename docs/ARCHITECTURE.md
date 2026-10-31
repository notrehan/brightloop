# Brightloop MVP architecture

- **Web:** Next.js App Router, React server components, server actions, and TypeScript.
- **Identity:** Supabase Auth. A Postgres trigger provisions profiles on signup. The first account in a clean project is the admin; later signups are portal customers.
- **Data:** Supabase Postgres with business-scoped rows and row-level security. Monetary values are integer paise.
- **Billing:** SQL RPCs create period invoices idempotently and record simulated payment attempts transactionally. A successful retry updates the invoice and subscription in the same database operation.
- **Customer access:** The portal queries only rows linked to the authenticated customer's `user_id`.

`supabase/setup_mvp.sql` is the single source of truth for this MVP schema and functions. It is a reset-and-install script, so it drops only the named Brightloop public tables and recreates them. It preserves Auth users and Storage files, then links existing Auth users to the seeded Brightloop business.
