-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "level" TEXT,
    "certificateId" TEXT,
    "issuedAt" DATETIME,
    "verifySlug" TEXT,
    "region" TEXT,
    "paymentCurrencyCode" TEXT,
    "paymentAmountCents" INTEGER NOT NULL DEFAULT 0,
    "paidAt" DATETIME,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "stripeSessionId" TEXT,
    "stripePaymentId" TEXT,
    CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Attempt" ("certificateId", "finishedAt", "id", "issuedAt", "level", "region", "startedAt", "status", "userId", "verifySlug") SELECT "certificateId", "finishedAt", "id", "issuedAt", "level", "region", "startedAt", "status", "userId", "verifySlug" FROM "Attempt";
DROP TABLE "Attempt";
ALTER TABLE "new_Attempt" RENAME TO "Attempt";
CREATE UNIQUE INDEX "Attempt_verifySlug_key" ON "Attempt"("verifySlug");
CREATE UNIQUE INDEX "Attempt_stripeSessionId_key" ON "Attempt"("stripeSessionId");
CREATE UNIQUE INDEX "Attempt_stripePaymentId_key" ON "Attempt"("stripePaymentId");
CREATE INDEX "idx_attempt_user" ON "Attempt"("userId");
CREATE INDEX "idx_attempt_pay_curr" ON "Attempt"("paymentCurrencyCode");
CREATE INDEX "idx_attempt_pay_status" ON "Attempt"("paymentStatus");
CREATE INDEX "idx_attempt_paid_at" ON "Attempt"("paidAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
