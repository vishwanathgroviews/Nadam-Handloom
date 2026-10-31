-- Counter/WhatsApp sales can now be recorded without a GST invoice. Every
-- existing order was invoiced (or is an online order, which always is), so
-- the default of true keeps history exactly as it was.
ALTER TABLE "Order" ADD COLUMN "invoiceRequired" BOOLEAN NOT NULL DEFAULT true;

-- Deleting a product that has sales history archives it instead of removing
-- it (its order lines and invoices reference it). NULL = a live product.
ALTER TABLE "Product" ADD COLUMN "deletedAt" TIMESTAMP(3);
