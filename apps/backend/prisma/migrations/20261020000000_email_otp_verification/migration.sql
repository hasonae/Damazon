ALTER TABLE "users"
  ADD COLUMN "email_verified_at" TIMESTAMP(3),
  ADD COLUMN "email_verification_required" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "email_verification_challenges" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "code_hash" CHAR(64) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_verification_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_verification_challenges_user_id_created_at_idx"
  ON "email_verification_challenges"("user_id", "created_at");
CREATE INDEX "email_verification_challenges_expires_at_consumed_at_idx"
  ON "email_verification_challenges"("expires_at", "consumed_at");

ALTER TABLE "email_verification_challenges"
  ADD CONSTRAINT "email_verification_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
