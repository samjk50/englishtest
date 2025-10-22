/*
  Warnings:

  - Added the required column `currencyCode` to the `Agent` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commissionPercent" REAL NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Agent" ("code", "commissionPercent", "createdAt", "email", "id", "name", "status", "updatedAt") SELECT "code", "commissionPercent", "createdAt", "email", "id", "name", "status", "updatedAt" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
CREATE UNIQUE INDEX "Agent_email_key" ON "Agent"("email");
CREATE UNIQUE INDEX "Agent_code_key" ON "Agent"("code");
CREATE INDEX "idx_agent_status" ON "Agent"("status");
CREATE INDEX "idx_agent_currency" ON "Agent"("currencyCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
