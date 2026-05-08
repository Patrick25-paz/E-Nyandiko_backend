-- DropIndex
DROP INDEX "idx_user_type";

-- AlterTable
ALTER TABLE "SubscriptionSettings" ADD COLUMN     "extraDeviceFee" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "registerDeviceFee" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "stolenDeviceFee" INTEGER NOT NULL DEFAULT 1000;
