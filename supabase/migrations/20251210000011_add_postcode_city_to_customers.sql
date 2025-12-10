-- Add postcode and city columns to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS postcode TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city TEXT;
