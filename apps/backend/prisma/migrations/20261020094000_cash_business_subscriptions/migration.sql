ALTER TYPE "PaymentMethod" ADD VALUE 'cash_subscription';
ALTER TYPE "NotificationType" ADD VALUE 'business';

ALTER TABLE "businesses"
  ADD COLUMN "subscription_suspended_at" TIMESTAMP(3);

ALTER TABLE "notifications"
  ADD COLUMN "dedupe_key" VARCHAR(180);

CREATE UNIQUE INDEX "notifications_dedupe_key_key"
  ON "notifications"("dedupe_key");
