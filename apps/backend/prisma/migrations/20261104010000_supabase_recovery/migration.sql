CREATE TABLE "supabase_recovery_challenges" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "supabase_user_id" UUID NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "email_verified_at" TIMESTAMP(3),
  "phone_verified_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supabase_recovery_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supabase_recovery_challenges_user_id_created_at_idx"
  ON "supabase_recovery_challenges"("user_id", "created_at");
CREATE INDEX "supabase_recovery_challenges_expires_at_consumed_at_idx"
  ON "supabase_recovery_challenges"("expires_at", "consumed_at");
ALTER TABLE "supabase_recovery_challenges"
  ADD CONSTRAINT "supabase_recovery_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supabase_identity_migrations"
  ADD COLUMN "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
