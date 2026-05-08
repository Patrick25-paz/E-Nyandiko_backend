-- CreateEnum
CREATE TYPE "DeviceIdentifierType" AS ENUM ('IMEI', 'SERIAL');

-- CreateTable
CREATE TABLE "DeviceIdentity" (
    "id" TEXT NOT NULL,
    "deviceTypeId" TEXT NOT NULL,
    "isReportedStolen" BOOLEAN NOT NULL DEFAULT false,
    "stolenReportedAt" TIMESTAMP(3),
    "stolenDescription" TEXT,
    "stolenReportedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceIdentifier" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "deviceTypeId" TEXT NOT NULL,
    "type" "DeviceIdentifierType" NOT NULL,
    "rawValue" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceIdentity_deviceTypeId_idx" ON "DeviceIdentity"("deviceTypeId");

-- CreateIndex
CREATE INDEX "DeviceIdentity_isReportedStolen_idx" ON "DeviceIdentity"("isReportedStolen");

-- CreateIndex
CREATE INDEX "DeviceIdentity_createdAt_idx" ON "DeviceIdentity"("createdAt");

-- CreateIndex
CREATE INDEX "DeviceIdentifier_identityId_idx" ON "DeviceIdentifier"("identityId");

-- CreateIndex
CREATE INDEX "DeviceIdentifier_type_idx" ON "DeviceIdentifier"("type");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceIdentifier_deviceTypeId_type_normalizedValue_key" ON "DeviceIdentifier"("deviceTypeId", "type", "normalizedValue");

-- AddForeignKey
ALTER TABLE "DeviceIdentity" ADD CONSTRAINT "DeviceIdentity_deviceTypeId_fkey" FOREIGN KEY ("deviceTypeId") REFERENCES "DeviceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceIdentity" ADD CONSTRAINT "DeviceIdentity_stolenReportedByUserId_fkey" FOREIGN KEY ("stolenReportedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceIdentifier" ADD CONSTRAINT "DeviceIdentifier_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "DeviceIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceIdentifier" ADD CONSTRAINT "DeviceIdentifier_deviceTypeId_fkey" FOREIGN KEY ("deviceTypeId") REFERENCES "DeviceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
