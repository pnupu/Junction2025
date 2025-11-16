-- DropIndex
DROP INDEX "EventGroupEvent_groupId_eventId_key";

-- CreateIndex
CREATE INDEX "EventGroupEvent_groupId_eventId_status_idx" ON "EventGroupEvent"("groupId", "eventId", "status");
