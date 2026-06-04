-- Add selling_price and is_for_sale columns to inventory_items table
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS is_for_sale BOOLEAN DEFAULT false;

-- Update existing items to have default values (optional, but good for consistency)
UPDATE public.inventory_items SET selling_price = 0.00 WHERE selling_price IS NULL;
UPDATE public.inventory_items SET is_for_sale = false WHERE is_for_sale IS NULL;
