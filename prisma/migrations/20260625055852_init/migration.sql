-- DropIndex
DROP INDEX "idx_contact_messages_created";

-- CreateIndex
CREATE INDEX "idx_contact_messages_created" ON "contact_messages"("created_at");
