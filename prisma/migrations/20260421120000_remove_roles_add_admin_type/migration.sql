-- Remove the RoleName enum value and update UserType enum to include ADMIN
-- Drop Role and UserRole tables (with cascade)
-- Migration to consolidate access control to type-only

-- Remove foreign key constraints from User to UserRole
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_roles_fkey" CASCADE;

-- Drop UserRole table
DROP TABLE IF EXISTS "UserRole" CASCADE;

-- Drop Role table
DROP TABLE IF EXISTS "Role" CASCADE;

-- Update the UserType enum to include ADMIN
ALTER TYPE "UserType" ADD VALUE 'ADMIN' AFTER 'SHOP';

-- Drop the RoleName enum (not used anymore)
DROP TYPE IF EXISTS "RoleName" CASCADE;

-- Add index on User.type for faster queries
CREATE INDEX IF NOT EXISTS "idx_user_type" ON "User"("type");
