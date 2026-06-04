-- Add inventory linking fields to restaurant_menu_items table
ALTER TABLE public.restaurant_menu_items 
ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES public.inventory_items(id),
ADD COLUMN IF NOT EXISTS inventory_quantity_needed FLOAT DEFAULT 1.0;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_inventory_item_id ON public.restaurant_menu_items(inventory_item_id);
