-- Fix RLS Policies for All Billing-Related Tables
-- Run this script in your Supabase SQL Editor to fix all permission issues

-- 1. Fix invoices table
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.invoices;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.invoices;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.invoices;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.invoices;

CREATE POLICY "invoices_select_policy" ON public.invoices
    FOR SELECT USING (true);

CREATE POLICY "invoices_insert_policy" ON public.invoices
    FOR INSERT WITH CHECK (true);

CREATE POLICY "invoices_update_policy" ON public.invoices
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "invoices_delete_policy" ON public.invoices
    FOR DELETE USING (true);

GRANT ALL ON public.invoices TO public;

-- 2. Fix invoice_items table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoice_items') THEN
        ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Enable read access for all users" ON public.invoice_items;
        DROP POLICY IF EXISTS "Enable insert access for all users" ON public.invoice_items;
        DROP POLICY IF EXISTS "Enable update access for all users" ON public.invoice_items;
        DROP POLICY IF EXISTS "Enable delete access for all users" ON public.invoice_items;
        
        CREATE POLICY "invoice_items_select_policy" ON public.invoice_items
            FOR SELECT USING (true);
        
        CREATE POLICY "invoice_items_insert_policy" ON public.invoice_items
            FOR INSERT WITH CHECK (true);
        
        CREATE POLICY "invoice_items_update_policy" ON public.invoice_items
            FOR UPDATE USING (true) WITH CHECK (true);
        
        CREATE POLICY "invoice_items_delete_policy" ON public.invoice_items
            FOR DELETE USING (true);
        
        GRANT ALL ON public.invoice_items TO public;
        
        RAISE NOTICE 'Invoice items table RLS policies created';
    ELSE
        RAISE NOTICE 'Invoice items table does not exist';
    END IF;
END $$;

-- 3. Fix payments table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
        ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Enable read access for all users" ON public.payments;
        DROP POLICY IF EXISTS "Enable insert access for all users" ON public.payments;
        DROP POLICY IF EXISTS "Enable update access for all users" ON public.payments;
        DROP POLICY IF EXISTS "Enable delete access for all users" ON public.payments;
        
        CREATE POLICY "payments_select_policy" ON public.payments
            FOR SELECT USING (true);
        
        CREATE POLICY "payments_insert_policy" ON public.payments
            FOR INSERT WITH CHECK (true);
        
        CREATE POLICY "payments_update_policy" ON public.payments
            FOR UPDATE USING (true) WITH CHECK (true);
        
        CREATE POLICY "payments_delete_policy" ON public.payments
            FOR DELETE USING (true);
        
        GRANT ALL ON public.payments TO public;
        
        RAISE NOTICE 'Payments table RLS policies created';
    ELSE
        RAISE NOTICE 'Payments table does not exist';
    END IF;
END $$;

-- 4. Fix billing_services table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_services') THEN
        ALTER TABLE public.billing_services ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Enable read access for all users" ON public.billing_services;
        DROP POLICY IF EXISTS "Enable insert access for all users" ON public.billing_services;
        DROP POLICY IF EXISTS "Enable update access for all users" ON public.billing_services;
        DROP POLICY IF EXISTS "Enable delete access for all users" ON public.billing_services;
        
        CREATE POLICY "billing_services_select_policy" ON public.billing_services
            FOR SELECT USING (true);
        
        CREATE POLICY "billing_services_insert_policy" ON public.billing_services
            FOR INSERT WITH CHECK (true);
        
        CREATE POLICY "billing_services_update_policy" ON public.billing_services
            FOR UPDATE USING (true) WITH CHECK (true);
        
        CREATE POLICY "billing_services_delete_policy" ON public.billing_services
            FOR DELETE USING (true);
        
        GRANT ALL ON public.billing_services TO public;
        
        RAISE NOTICE 'Billing services table RLS policies created';
    ELSE
        RAISE NOTICE 'Billing services table does not exist';
    END IF;
END $$;

-- 5. Verify all policies were created
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd
FROM pg_policies 
WHERE tablename IN ('invoices', 'invoice_items', 'payments', 'billing_services')
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- 6. Test invoice creation
INSERT INTO public.invoices (guest_name, room_number, check_in_date, check_out_date, total_amount, status, created_at) 
VALUES ('Test Invoice', '01', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', 300.00, 'Pending', NOW())
RETURNING id, guest_name, room_number, total_amount;

-- 7. Clean up test data
DELETE FROM public.invoices WHERE guest_name = 'Test Invoice';

-- 8. Final verification
SELECT 'All billing tables RLS setup complete' as status;
