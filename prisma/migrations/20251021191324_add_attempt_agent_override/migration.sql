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
    "stripePaymentId" TEXT,
    "stripeSessionId" TEXT,
    "agentId" TEXT,
    CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attempt_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Attempt" ("certificateId", "finishedAt", "id", "issuedAt", "level", "paidAt", "paymentAmountCents", "paymentCurrencyCode", "paymentStatus", "region", "startedAt", "status", "stripePaymentId", "stripeSessionId", "userId", "verifySlug") SELECT "certificateId", "finishedAt", "id", "issuedAt", "level", "paidAt", "paymentAmountCents", "paymentCurrencyCode", "paymentStatus", "region", "startedAt", "status", "stripePaymentId", "stripeSessionId", "userId", "verifySlug" FROM "Attempt";
DROP TABLE "Attempt";
ALTER TABLE "new_Attempt" RENAME TO "Attempt";
CREATE UNIQUE INDEX "Attempt_verifySlug_key" ON "Attempt"("verifySlug");
CREATE UNIQUE INDEX "Attempt_stripePaymentId_key" ON "Attempt"("stripePaymentId");
CREATE UNIQUE INDEX "Attempt_stripeSessionId_key" ON "Attempt"("stripeSessionId");
CREATE INDEX "idx_attempt_agent_override" ON "Attempt"("agentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
