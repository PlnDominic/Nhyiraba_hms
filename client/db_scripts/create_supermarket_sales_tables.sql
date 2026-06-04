-- Create table for supermarket sales (receipts)
CREATE TABLE IF NOT EXISTS public.supermarket_sales (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    receipt_number TEXT UNIQUE NOT NULL, -- e.g., RCP-20231027-001
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method TEXT NOT NULL, -- 'cash', 'card', 'room'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES auth.users(id)
);

-- Create table for supermarket sale items
CREATE TABLE IF NOT EXISTS public.supermarket_sale_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sale_id UUID REFERENCES public.supermarket_sales(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.inventory_items(id),
    item_name TEXT NOT NULL, -- Snapshot of name in case it changes
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL, -- The price at the time of sale (potentially edited)
    total_price DECIMAL(10, 2) NOT NULL
);

-- Enable RLS
ALTER TABLE public.supermarket_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supermarket_sale_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for authenticated users" ON public.supermarket_sales
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.supermarket_sales
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON public.supermarket_sale_items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.supermarket_sale_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
