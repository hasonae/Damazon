ALTER TABLE "users"
  ADD COLUMN "supabase_user_id" UUID;

CREATE UNIQUE INDEX "users_supabase_user_id_key"
  ON "users"("supabase_user_id");

CREATE TABLE "supabase_identity_migrations" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "supabase_user_id" UUID NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "email_verified_at" TIMESTAMP(3),
  "phone_verified_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supabase_identity_migrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supabase_identity_migrations_user_id_key"
  ON "supabase_identity_migrations"("user_id");
CREATE UNIQUE INDEX "supabase_identity_migrations_supabase_user_id_key"
  ON "supabase_identity_migrations"("supabase_user_id");
CREATE INDEX "supabase_identity_migrations_expires_at_idx"
  ON "supabase_identity_migrations"("expires_at");
ALTER TABLE "supabase_identity_migrations"
  ADD CONSTRAINT "supabase_identity_migrations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "supabase_login_challenges" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "supabase_user_id" UUID NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supabase_login_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supabase_login_challenges_user_id_created_at_idx"
  ON "supabase_login_challenges"("user_id", "created_at");
CREATE INDEX "supabase_login_challenges_expires_at_consumed_at_idx"
  ON "supabase_login_challenges"("expires_at", "consumed_at");
ALTER TABLE "supabase_login_challenges"
  ADD CONSTRAINT "supabase_login_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
