-- Add composite indexes for storefront and admin list filters.
CREATE INDEX IF NOT EXISTS "Product_isActive_createdAt_idx" ON "Product"("isActive", "createdAt");
CREATE INDEX IF NOT EXISTS "Product_isActive_categoryId_idx" ON "Product"("isActive", "categoryId");
CREATE INDEX IF NOT EXISTS "Order_paymentStatus_status_createdAt_idx" ON "Order"("paymentStatus", "status", "createdAt");
