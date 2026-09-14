-- CreateEnum
CREATE TYPE "Module" AS ENUM ('MILK', 'LAND', 'SHOP');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "assignedModules" "Module"[] DEFAULT ARRAY[]::"Module"[];
