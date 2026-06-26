-- Enable pg_trgm extension for ILIKE search performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for client search (User table)
CREATE INDEX IF NOT EXISTS idx_user_full_name_trgm ON "User" USING gin ("fullName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_email_trgm ON "User" USING gin ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_national_id_trgm ON "User" USING gin ("nationalId" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_client_code_trgm ON "User" USING gin ("clientCode" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_phone_trgm ON "User" USING gin ("phone" gin_trgm_ops);

-- Trigram indexes for shop search (Seller table)
CREATE INDEX IF NOT EXISTS idx_seller_business_name_trgm ON "Seller" USING gin ("businessName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_seller_phone_trgm ON "Seller" USING gin ("phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_seller_whatsapp_trgm ON "Seller" USING gin ("whatsapp" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_seller_location_trgm ON "Seller" USING gin ("location" gin_trgm_ops);
