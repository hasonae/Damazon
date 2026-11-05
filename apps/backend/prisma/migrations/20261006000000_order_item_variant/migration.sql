-- Add the variant reference to order line snapshots.
-- An order line must remember which variant was sold: checkout decrements
-- variant stock, and a cancellation has to restore exactly that variant.
ALTER TABLE "order_items" ADD COLUMN "variant_id" UUID;

CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
