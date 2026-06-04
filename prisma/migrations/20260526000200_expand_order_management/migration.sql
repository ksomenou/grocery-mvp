ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TYPE "FulfillmentMethod" AS ENUM ('DELIVERY', 'PICKUP');

ALTER TABLE "Order"
  ADD COLUMN "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'DELIVERY',
  ADD COLUMN "stockReduced" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Order"
SET "fulfillmentMethod" = 'PICKUP'
WHERE "deliveryFeeCents" = 0 OR LOWER("deliveryAddress") LIKE '%pickup%';

UPDATE "Order"
SET "status" = 'READY'
WHERE "status" = 'COMPLETED';
