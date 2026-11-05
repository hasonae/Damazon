CREATE TYPE "AdvertisementStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

CREATE TABLE "advertisements" (
    "id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "caption" VARCHAR(500),
    "image_url" VARCHAR(500) NOT NULL,
    "target_url" VARCHAR(1000),
    "status" "AdvertisementStatus" NOT NULL DEFAULT 'draft',
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "advertisements_status_starts_at_ends_at_position_idx"
    ON "advertisements"("status", "starts_at", "ends_at", "position");

ALTER TABLE "advertisements"
    ADD CONSTRAINT "advertisements_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
