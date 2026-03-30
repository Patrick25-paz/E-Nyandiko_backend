-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionClaimStatus" AS ENUM ('CLAIMED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "SubscriptionSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "monthlyFee" INTEGER NOT NULL DEFAULT 2000,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionClaim" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "SubscriptionClaimStatus" NOT NULL DEFAULT 'CLAIMED',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "SubscriptionClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerSubscription" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimId" TEXT,

    CONSTRAINT "SellerSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionClaim_sellerId_idx" ON "SubscriptionClaim"("sellerId");

-- CreateIndex
CREATE INDEX "SubscriptionClaim_status_idx" ON "SubscriptionClaim"("status");

-- CreateIndex
CREATE INDEX "SubscriptionClaim_createdAt_idx" ON "SubscriptionClaim"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SellerSubscription_claimId_key" ON "SellerSubscription"("claimId");

-- CreateIndex
CREATE INDEX "SellerSubscription_sellerId_idx" ON "SellerSubscription"("sellerId");

-- CreateIndex
CREATE INDEX "SellerSubscription_status_idx" ON "SellerSubscription"("status");

-- CreateIndex
CREATE INDEX "SellerSubscription_startAt_idx" ON "SellerSubscription"("startAt");

-- CreateIndex
CREATE INDEX "SellerSubscription_endAt_idx" ON "SellerSubscription"("endAt");

-- AddForeignKey
ALTER TABLE "SubscriptionClaim" ADD CONSTRAINT "SubscriptionClaim_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionClaim" ADD CONSTRAINT "SubscriptionClaim_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerSubscription" ADD CONSTRAINT "SellerSubscription_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerSubscription" ADD CONSTRAINT "SellerSubscription_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "SubscriptionClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
