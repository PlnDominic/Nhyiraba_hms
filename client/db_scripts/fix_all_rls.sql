-- Enable RLS on all relevant tables
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public access" ON public.guests;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.reservations;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.reservations;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.reservations;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.reservations;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.rooms;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.rooms;

-- Create permissive policies for guests (allow everything for everyone)
CREATE POLICY "Allow public access" ON public.guests
  FOR ALL USING (true);

-- Create permissive policies for reservations (allow everything for everyone)
CREATE POLICY "Allow public access" ON public.reservations
  FOR ALL USING (true);

-- Create permissive policies for rooms (allow everything for everyone)
CREATE POLICY "Allow public access" ON public.rooms
  FOR ALL USING (true);

-- Verify policies
SELECT * FROM pg_policies WHERE tablename IN ('guests', 'reservations', 'rooms');
