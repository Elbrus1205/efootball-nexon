ALTER TYPE "ProfileStatusType" ADD VALUE IF NOT EXISTS 'AMBASSADOR';

ALTER TABLE "UserProfileStatus"
ADD COLUMN "youtubeUrl" TEXT,
ADD COLUMN "youtubeChannelTitle" TEXT;
