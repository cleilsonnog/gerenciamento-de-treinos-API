-- CreateTable
CREATE TABLE "admin_log" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_log_adminId_idx" ON "admin_log"("adminId");

-- CreateIndex
CREATE INDEX "admin_log_action_idx" ON "admin_log"("action");

-- CreateIndex
CREATE INDEX "admin_log_createdAt_idx" ON "admin_log"("createdAt");

-- AddForeignKey
ALTER TABLE "admin_log" ADD CONSTRAINT "admin_log_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_log" ADD CONSTRAINT "admin_log_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
