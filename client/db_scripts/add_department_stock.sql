-- Create table for department level stock tracking
CREATE TABLE IF NOT EXISTS public.department_stock (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    department_name TEXT NOT NULL, -- e.g., 'Supermarket', 'Housekeeping', 'VIP Pub'
    current_stock DECIMAL(10, 2) DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(item_id, department_name)
);

-- Enable RLS on the new table
ALTER TABLE public.department_stock ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for department_stock
CREATE POLICY "Enable read access for all authenticated users" ON public.department_stock
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert/update for authenticated users" ON public.department_stock
    FOR ALL USING (auth.role() = 'authenticated');

-- Add department_name to inventory_transactions to track where transactions occur
ALTER TABLE public.inventory_transactions 
ADD COLUMN IF NOT EXISTS department_name TEXT DEFAULT 'Main Store';

-- Add transfer-related columns to inventory_transactions
ALTER TABLE public.inventory_transactions 
ADD COLUMN IF NOT EXISTS transfer_to TEXT, -- Destination for transfers
ADD COLUMN IF NOT EXISTS transfer_from TEXT; -- Source for transfers
