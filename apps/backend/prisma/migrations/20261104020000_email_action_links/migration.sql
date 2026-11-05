ALTER TABLE "email_verification_challenges"
  ADD COLUMN "purpose" VARCHAR(16) NOT NULL DEFAULT 'verify';

CREATE INDEX "email_verification_challenges_purpose_expires_at_idx"
  ON "email_verification_challenges"("purpose", "expires_at");
