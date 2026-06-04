# FreshCart Grocery MVP

A simple local-delivery grocery storefront built with Next.js, Prisma, PostgreSQL, Stripe Checkout, and local image uploads.

## Features

- Customer homepage, categories, product listing, search, product detail pages, cart, checkout, Stripe payment redirect, and order confirmation.
- Admin dashboard for products, categories, image uploads, image previews, price changes, low-stock warnings, stock management, order review, delivery addresses, and order status updates.
- Optional admin password protection with `ADMIN_PASSWORD`.
- Local delivery only with a fixed `DELIVERY_FEE_CENTS`.

## Setup

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, Stripe keys, and `ADMIN_PASSWORD`.
2. Create the database and run migrations:

```bash
npm run prisma:migrate
```

3. Seed starter categories and products:

```bash
npm run prisma:seed
```

4. Start the app:

```bash
npm run dev
```

The app runs at `http://localhost:3000` by default.

## Useful Commands

```bash
npm run lint
npm run build
npm run prisma:generate
```
