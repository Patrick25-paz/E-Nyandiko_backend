-- CreateIndex
CREATE INDEX "SellerSubscription_status_endAt_idx" ON "SellerSubscription"("status", "endAt");

-- CreateIndex
CREATE INDEX "User_type_idx" ON "User"("type");
