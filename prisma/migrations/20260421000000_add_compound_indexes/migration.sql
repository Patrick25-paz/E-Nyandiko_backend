-- CreateIndex for Device (sellerId, createdAt)
CREATE INDEX "Device_sellerId_createdAt_idx" ON "Device"("sellerId" ASC, "createdAt" ASC);

-- CreateIndex for Agreement (sellerId, createdAt)
CREATE INDEX "Agreement_sellerId_createdAt_idx" ON "Agreement"("sellerId" ASC, "createdAt" ASC);

-- CreateIndex for Agreement (buyerId, createdAt)
CREATE INDEX "Agreement_buyerId_createdAt_idx" ON "Agreement"("buyerId" ASC, "createdAt" ASC);

-- CreateIndex for Payment (agreementId, paidAt)
CREATE INDEX "Payment_agreementId_paidAt_idx" ON "Payment"("agreementId" ASC, "paidAt" ASC);
