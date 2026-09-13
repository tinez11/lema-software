-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'WORKER');

-- CreateEnum
CREATE TYPE "AnimalStatus" AS ENUM ('ACTIVE', 'SOLD', 'DECEASED');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "MilkSession" AS ENUM ('MORNING', 'EVENING');

-- CreateEnum
CREATE TYPE "HealthEventType" AS ENUM ('VACCINATION', 'ILLNESS', 'TREATMENT');

-- CreateEnum
CREATE TYPE "CropCycleStatus" AS ENUM ('PLANNED', 'GROWING', 'HARVESTED');

-- CreateEnum
CREATE TYPE "InputType" AS ENUM ('SEED', 'FERTILIZER', 'PESTICIDE', 'LABOR');

-- CreateEnum
CREATE TYPE "StockAdjustmentType" AS ENUM ('RESTOCK', 'SALE_DEDUCTION', 'WASTAGE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "tagNumber" TEXT NOT NULL,
    "name" TEXT,
    "breed" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "sex" "Sex" NOT NULL,
    "status" "AnimalStatus" NOT NULL DEFAULT 'ACTIVE',
    "photoUrl" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enteredById" TEXT NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "date" DATE NOT NULL,
    "session" "MilkSession" NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "MilkRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "animalId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "HealthEventType" NOT NULL,
    "notes" TEXT,
    "cost" DECIMAL(10,2),
    "vetName" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "HealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "animalId" TEXT NOT NULL,
    "matingDate" DATE NOT NULL,
    "expectedCalvingDate" DATE,
    "actualCalvingDate" DATE,
    "calfAnimalId" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "BreedingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "date" DATE NOT NULL,
    "feedType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "FeedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Field" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sizeAcres" DOUBLE PRECISION,
    "locationNote" TEXT,
    "soilType" TEXT,

    CONSTRAINT "Field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropCycle" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "fieldId" TEXT NOT NULL,
    "cropType" TEXT NOT NULL,
    "plantingDate" DATE NOT NULL,
    "expectedHarvestDate" DATE,
    "actualHarvestDate" DATE,
    "status" "CropCycleStatus" NOT NULL DEFAULT 'PLANNED',
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enteredById" TEXT NOT NULL,

    CONSTRAINT "CropCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InputRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "cropCycleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "InputType" NOT NULL,
    "quantity" DOUBLE PRECISION,
    "cost" DECIMAL(10,2) NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "InputRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HarvestRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "cropCycleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "qualityGrade" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "HarvestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "lowStockThreshold" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "stockItemId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "StockAdjustmentType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Animal_clientId_key" ON "Animal"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_tagNumber_key" ON "Animal"("tagNumber");

-- CreateIndex
CREATE INDEX "Animal_status_idx" ON "Animal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MilkRecord_clientId_key" ON "MilkRecord"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "MilkRecord_date_session_key" ON "MilkRecord"("date", "session");

-- CreateIndex
CREATE UNIQUE INDEX "HealthRecord_clientId_key" ON "HealthRecord"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingRecord_clientId_key" ON "BreedingRecord"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedRecord_clientId_key" ON "FeedRecord"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CropCycle_clientId_key" ON "CropCycle"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "InputRecord_clientId_key" ON "InputRecord"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "HarvestRecord_clientId_key" ON "HarvestRecord"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_clientId_key" ON "StockAdjustment"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_clientId_key" ON "Sale"("clientId");

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkRecord" ADD CONSTRAINT "MilkRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthRecord" ADD CONSTRAINT "HealthRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_calfAnimalId_fkey" FOREIGN KEY ("calfAnimalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingRecord" ADD CONSTRAINT "BreedingRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedRecord" ADD CONSTRAINT "FeedRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropCycle" ADD CONSTRAINT "CropCycle_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InputRecord" ADD CONSTRAINT "InputRecord_cropCycleId_fkey" FOREIGN KEY ("cropCycleId") REFERENCES "CropCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InputRecord" ADD CONSTRAINT "InputRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestRecord" ADD CONSTRAINT "HarvestRecord_cropCycleId_fkey" FOREIGN KEY ("cropCycleId") REFERENCES "CropCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarvestRecord" ADD CONSTRAINT "HarvestRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
