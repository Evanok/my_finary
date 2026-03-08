/*
  Warnings:

  - You are about to drop the column `price` on the `PriceCache` table. All the data in the column will be lost.
  - Added the required column `priceUsd` to the `PriceCache` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "FxRateCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pair" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "nativeCurrency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Asset" ("category", "createdAt", "id", "name", "symbol") SELECT "category", "createdAt", "id", "name", "symbol" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE UNIQUE INDEX "Asset_symbol_key" ON "Asset"("symbol");
CREATE TABLE "new_PriceCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "priceUsd" REAL NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PriceCache_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PriceCache" ("assetId", "fetchedAt", "id", "source", "validated") SELECT "assetId", "fetchedAt", "id", "source", "validated" FROM "PriceCache";
DROP TABLE "PriceCache";
ALTER TABLE "new_PriceCache" RENAME TO "PriceCache";
CREATE UNIQUE INDEX "PriceCache_assetId_source_key" ON "PriceCache"("assetId", "source");
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "quantity" REAL NOT NULL,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("accountId", "assetId", "createdAt", "date", "id", "price", "quantity", "type") SELECT "accountId", "assetId", "createdAt", "date", "id", "price", "quantity", "type" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FxRateCache_pair_key" ON "FxRateCache"("pair");
