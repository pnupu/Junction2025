-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dietaryRestrictions" TEXT[],
    "allergies" TEXT[],
    "cuisinePreferences" TEXT[],
    "activityTypes" TEXT[],
    "preferredTime" TEXT,
    "preferredDay" TEXT,
    "budgetRange" TEXT,
    "groupSizePreference" INTEGER,
    "socialPreference" TEXT,
    "preferredLocations" TEXT[],
    "maxTravelDistance" INTEGER,
    "experienceIntensity" TEXT,
    "interests" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "venueType" TEXT NOT NULL,
    "priceRange" TEXT,
    "rating" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "duration" INTEGER,
    "priceRange" TEXT,
    "difficulty" TEXT,
    "capacity" INTEGER,
    "venueId" TEXT,
    "customLocation" TEXT,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventOpportunity" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT,
    "locationType" TEXT NOT NULL,
    "locationDetails" TEXT,
    "opportunityType" TEXT,
    "woltContribution" TEXT NOT NULL,
    "partnerVenues" TEXT[],
    "keywords" TEXT[],
    "estimatedBudget" TEXT,
    "idealUseCase" TEXT,
    "seasonality" TEXT,
    "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'idea',
    "sourceModel" TEXT,
    "rawPayload" JSONB,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfrastructureVenue" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "description" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "officialLink" TEXT,
    "notes" TEXT,
    "woltPartnerTier" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfrastructureVenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityVenueRef" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "usageNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityVenueRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCategory" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "inviteCode" TEXT NOT NULL,
    "creatorId" TEXT,
    "targetDate" TIMESTAMP(3),
    "targetTime" TEXT,
    "budgetRange" TEXT,
    "preferredLocation" TEXT,
    "city" TEXT,
    "status" TEXT NOT NULL DEFAULT 'collecting_preferences',
    "isGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventGroupPreference" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "userName" TEXT,
    "userIcon" TEXT NOT NULL,
    "moneyPreference" TEXT NOT NULL,
    "activityLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventGroupPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventGroupParticipant" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "status" TEXT NOT NULL DEFAULT 'invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventGroupParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventGroupEvent" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventGroupEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRecommendation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "groupId" TEXT,
    "userId" TEXT,
    "opportunityId" TEXT,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT,
    "modelVersion" TEXT,
    "features" JSONB,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "rating" INTEGER,
    "liked" BOOLEAN,
    "feedback" TEXT,
    "wouldAttend" BOOLEAN,
    "groupId" TEXT,
    "recommendationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Category_name_idx" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Venue_city_country_idx" ON "Venue"("city", "country");

-- CreateIndex
CREATE INDEX "Venue_venueType_idx" ON "Venue"("venueType");

-- CreateIndex
CREATE INDEX "Venue_externalId_idx" ON "Venue"("externalId");

-- CreateIndex
CREATE INDEX "Event_venueId_idx" ON "Event"("venueId");

-- CreateIndex
CREATE INDEX "Event_isActive_idx" ON "Event"("isActive");

-- CreateIndex
CREATE INDEX "Event_popularityScore_idx" ON "Event"("popularityScore");

-- CreateIndex
CREATE UNIQUE INDEX "EventOpportunity_slug_key" ON "EventOpportunity"("slug");

-- CreateIndex
CREATE INDEX "EventOpportunity_city_idx" ON "EventOpportunity"("city");

-- CreateIndex
CREATE INDEX "EventOpportunity_status_idx" ON "EventOpportunity"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InfrastructureVenue_slug_key" ON "InfrastructureVenue"("slug");

-- CreateIndex
CREATE INDEX "InfrastructureVenue_city_idx" ON "InfrastructureVenue"("city");

-- CreateIndex
CREATE INDEX "InfrastructureVenue_type_idx" ON "InfrastructureVenue"("type");

-- CreateIndex
CREATE UNIQUE INDEX "InfrastructureVenue_sourceName_sourceId_key" ON "InfrastructureVenue"("sourceName", "sourceId");

-- CreateIndex
CREATE INDEX "OpportunityVenueRef_venueId_idx" ON "OpportunityVenueRef"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityVenueRef_opportunityId_venueId_key" ON "OpportunityVenueRef"("opportunityId", "venueId");

-- CreateIndex
CREATE INDEX "EventCategory_eventId_idx" ON "EventCategory"("eventId");

-- CreateIndex
CREATE INDEX "EventCategory_categoryId_idx" ON "EventCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "EventCategory_eventId_categoryId_key" ON "EventCategory"("eventId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "EventGroup_inviteCode_key" ON "EventGroup"("inviteCode");

-- CreateIndex
CREATE INDEX "EventGroup_status_idx" ON "EventGroup"("status");

-- CreateIndex
CREATE INDEX "EventGroup_inviteCode_idx" ON "EventGroup"("inviteCode");

-- CreateIndex
CREATE INDEX "EventGroupPreference_groupId_idx" ON "EventGroupPreference"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "EventGroupPreference_groupId_sessionId_key" ON "EventGroupPreference"("groupId", "sessionId");

-- CreateIndex
CREATE INDEX "EventGroupParticipant_groupId_idx" ON "EventGroupParticipant"("groupId");

-- CreateIndex
CREATE INDEX "EventGroupParticipant_userId_idx" ON "EventGroupParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventGroupParticipant_groupId_userId_key" ON "EventGroupParticipant"("groupId", "userId");

-- CreateIndex
CREATE INDEX "EventGroupEvent_groupId_idx" ON "EventGroupEvent"("groupId");

-- CreateIndex
CREATE INDEX "EventGroupEvent_eventId_idx" ON "EventGroupEvent"("eventId");

-- CreateIndex
CREATE INDEX "EventGroupEvent_status_idx" ON "EventGroupEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EventGroupEvent_groupId_eventId_key" ON "EventGroupEvent"("groupId", "eventId");

-- CreateIndex
CREATE INDEX "EventRecommendation_eventId_idx" ON "EventRecommendation"("eventId");

-- CreateIndex
CREATE INDEX "EventRecommendation_groupId_idx" ON "EventRecommendation"("groupId");

-- CreateIndex
CREATE INDEX "EventRecommendation_userId_idx" ON "EventRecommendation"("userId");

-- CreateIndex
CREATE INDEX "EventRecommendation_opportunityId_idx" ON "EventRecommendation"("opportunityId");

-- CreateIndex
CREATE INDEX "EventRecommendation_matchScore_idx" ON "EventRecommendation"("matchScore");

-- CreateIndex
CREATE INDEX "EventRecommendation_status_idx" ON "EventRecommendation"("status");

-- CreateIndex
CREATE INDEX "UserFeedback_userId_idx" ON "UserFeedback"("userId");

-- CreateIndex
CREATE INDEX "UserFeedback_eventId_idx" ON "UserFeedback"("eventId");

-- CreateIndex
CREATE INDEX "UserFeedback_groupId_idx" ON "UserFeedback"("groupId");

-- CreateIndex
CREATE INDEX "UserFeedback_rating_idx" ON "UserFeedback"("rating");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOpportunity" ADD CONSTRAINT "EventOpportunity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityVenueRef" ADD CONSTRAINT "OpportunityVenueRef_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "EventOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityVenueRef" ADD CONSTRAINT "OpportunityVenueRef_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "InfrastructureVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCategory" ADD CONSTRAINT "EventCategory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCategory" ADD CONSTRAINT "EventCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGroup" ADD CONSTRAINT "EventGroup_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGroupPreference" ADD CONSTRAINT "EventGroupPreference_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EventGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGroupParticipant" ADD CONSTRAINT "EventGroupParticipant_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EventGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGroupParticipant" ADD CONSTRAINT "EventGroupParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGroupEvent" ADD CONSTRAINT "EventGroupEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EventGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGroupEvent" ADD CONSTRAINT "EventGroupEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecommendation" ADD CONSTRAINT "EventRecommendation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecommendation" ADD CONSTRAINT "EventRecommendation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "EventGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecommendation" ADD CONSTRAINT "EventRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRecommendation" ADD CONSTRAINT "EventRecommendation_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "EventOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFeedback" ADD CONSTRAINT "UserFeedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
