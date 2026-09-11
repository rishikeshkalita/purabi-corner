# Purabi Corner

Modern mobile-first POS and sales analytics starter for a dairy retail store.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Supabase-ready data layer
- Business-day reset at 3:00 AM

## Business day

A Purabi business day runs from 03:00:00 through 02:59:59 the following calendar day. Historical sales are retained; the counter simply filters to the active business day.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The current UI runs with demo data so it can be previewed without a backend. `supabase.sql` contains the production schema and indexes for `products` and `sales`.
