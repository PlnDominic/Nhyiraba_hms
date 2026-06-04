-- Add bar_location column to restaurant_orders table
ALTER TABLE public.restaurant_orders 
ADD COLUMN IF NOT EXISTS bar_location TEXT;

-- Optional: Update existing orders to a default location if needed
-- UPDATE public.restaurant_orders SET bar_location = 'VIP pub' WHERE bar_location IS NULL;
