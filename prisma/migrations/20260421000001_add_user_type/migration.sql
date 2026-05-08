-- Add UserType enum and type field to User
CREATE TYPE "UserType" AS ENUM ('INDIVIDUAL', 'SHOP');
ALTER TABLE "User" ADD COLUMN "type" "UserType" NOT NULL DEFAULT 'INDIVIDUAL';
