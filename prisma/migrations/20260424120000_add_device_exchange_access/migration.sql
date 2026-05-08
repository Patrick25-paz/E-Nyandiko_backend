-- CreateTable
CREATE TABLE "DeviceExchangeAccess" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ownerSellerId" TEXT NOT NULL,
    "grantedToSellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceExchangeAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceExchangeAccess_deviceId_key" ON "DeviceExchangeAccess"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceExchangeAccess_ownerSellerId_idx" ON "DeviceExchangeAccess"("ownerSellerId");

-- CreateIndex
CREATE INDEX "DeviceExchangeAccess_grantedToSellerId_idx" ON "DeviceExchangeAccess"("grantedToSellerId");

-- AddForeignKey
ALTER TABLE "DeviceExchangeAccess" ADD CONSTRAINT "DeviceExchangeAccess_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceExchangeAccess" ADD CONSTRAINT "DeviceExchangeAccess_ownerSellerId_fkey" FOREIGN KEY ("ownerSellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceExchangeAccess" ADD CONSTRAINT "DeviceExchangeAccess_grantedToSellerId_fkey" FOREIGN KEY ("grantedToSellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
