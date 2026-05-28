-- Add user profile image fields
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "profileImagePublicId" TEXT;