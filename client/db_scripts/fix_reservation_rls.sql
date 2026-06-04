-- Enable RLS on reservations table
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.reservations;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.reservations;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.reservations;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.reservations;

-- Create comprehensive policies for reservations
-- Allow all authenticated users to view reservations
CREATE POLICY "Enable read access for authenticated users"
ON public.reservations FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to insert reservations
CREATE POLICY "Enable insert access for authenticated users"
ON public.reservations FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to update reservations
CREATE POLICY "Enable update access for authenticated users"
ON public.reservations FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow all authenticated users to delete reservations
CREATE POLICY "Enable delete access for authenticated users"
ON public.reservations FOR DELETE
TO authenticated
USING (true);

-- Also ensure rooms table is accessible
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.rooms;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.rooms;

CREATE POLICY "Enable read access for authenticated users"
ON public.rooms FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable update access for authenticated users"
ON public.rooms FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Verify policies
SELECT * FROM pg_policies WHERE tablename IN ('reservations', 'rooms');
