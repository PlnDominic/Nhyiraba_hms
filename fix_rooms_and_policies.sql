-- Fix RLS Policies and Update Room Numbering (01-15)
-- Run this script in your Supabase SQL Editor to fix the room data and access issues
-- For single hotel architecture (no multi-tenancy)

-- 1. Set up RLS policies to allow public access
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public access to rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.rooms;
DROP POLICY IF EXISTS "Allow anonymous read access to rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow anonymous insert to rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow anonymous update to rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow anonymous delete from rooms" ON public.rooms;

DROP POLICY IF EXISTS "Allow public access to reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.reservations;
DROP POLICY IF EXISTS "Allow anonymous read access to reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow anonymous insert to reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow anonymous update to reservations" ON public.reservations;
DROP POLICY IF EXISTS "Allow anonymous delete from reservations" ON public.reservations;

-- Create new policies allowing public access
CREATE POLICY "Allow public access to rooms" ON public.rooms FOR ALL USING (true);
CREATE POLICY "Allow public access to reservations" ON public.reservations FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON public.rooms TO anon, authenticated;
GRANT ALL ON public.reservations TO anon, authenticated;

-- 2. Delete all existing rooms and create new ones numbered 01-15
DELETE FROM public.rooms;

-- Insert new rooms numbered 01-15
INSERT INTO public.rooms (id, room_number, type, status, price, capacity, amenities) 
VALUES
  -- Standard Rooms (01-09) - 500 Ghana Cedis
  (1, '01', 'Standard', 'Available', 500, 2, ARRAY['WiFi', 'TV', 'AC']),
  (2, '02', 'Standard', 'Available', 500, 2, ARRAY['WiFi', 'TV', 'AC']),
  (3, '03', 'Standard', 'Available', 500, 2, ARRAY['WiFi', 'TV', 'AC']),
  (4, '04', 'Standard', 'Available', 500, 2, ARRAY['WiFi', 'TV', 'AC']),
  (5, '05', 'Standard', 'Available', 500, 2, ARRAY['WiFi', 'TV', 'AC']),
  (6, '06', 'Standard', 'Available', 500, 2, ARRAY['WiFi', 'TV', 'AC']),
  (7, '07', 'Standard', 'Available', 500, 2, ARRAY['WiFi', 'TV', 'AC']),
  (8, '08', 'Standard', 'Available', 500, 2, ARRAY['WiFi', 'TV', 'AC']),
  (9, '09', 'Standard', 'Available', 500, 2, ARRAY['WiFi', 'TV', 'AC']),
  
  -- Superior Rooms (10-13) - 750 Ghana Cedis
  (10, '10', 'Superior', 'Available', 750, 3, ARRAY['WiFi', 'TV', 'AC', 'Mini Bar']),
  (11, '11', 'Superior', 'Available', 750, 3, ARRAY['WiFi', 'TV', 'AC', 'Mini Bar']),
  (12, '12', 'Superior', 'Available', 750, 3, ARRAY['WiFi', 'TV', 'AC', 'Mini Bar']),
  (13, '13', 'Superior', 'Available', 750, 3, ARRAY['WiFi', 'TV', 'AC', 'Mini Bar']),
  
  -- Executive Rooms (14-15) - 1250 Ghana Cedis
  (14, '14', 'Executive', 'Available', 1250, 4, ARRAY['WiFi', 'TV', 'AC', 'Mini Bar', 'Jacuzzi', 'Room Service']),
  (15, '15', 'Executive', 'Available', 1250, 4, ARRAY['WiFi', 'TV', 'AC', 'Mini Bar', 'Jacuzzi', 'Room Service']);

-- 3. Create some sample reservations for testing
INSERT INTO public.reservations (room_id, room_type, guest_name, guest_email, guest_phone, check_in_date, check_out_date, adults, children, status, payment_method, payment_status)
VALUES
  (3, 'Standard', 'John Doe', 'john.doe@email.com', '+233-123-456-789', CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '3 days', 2, 0, 'Reserved', 'Credit Card', 'Paid'),
  (7, 'Standard', 'Jane Smith', 'jane.smith@email.com', '+233-987-654-321', CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '7 days', 1, 1, 'Reserved', 'Cash', 'Pending'),
  (12, 'Superior', 'Bob Johnson', 'bob.johnson@email.com', '+233-555-123-456', CURRENT_DATE, CURRENT_DATE + INTERVAL '2 days', 2, 2, 'Checked In', 'Credit Card', 'Paid');

-- 4. Update room statuses based on reservations
UPDATE public.rooms 
SET status = 'Reserved' 
WHERE id IN (SELECT room_id FROM public.reservations WHERE status = 'Reserved');

UPDATE public.rooms 
SET status = 'Occupied' 
WHERE id IN (SELECT room_id FROM public.reservations WHERE status = 'Checked In');

-- 5. Enable realtime subscriptions
DO $$
BEGIN
  -- Add rooms table to realtime publication if not already added
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'rooms'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.rooms;
    RAISE NOTICE 'Added rooms table to realtime publication';
  END IF;

  -- Add reservations table to realtime publication if not already added
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'reservations'
  ) THEN
    ALTER publication supabase_realtime ADD TABLE public.reservations;
    RAISE NOTICE 'Added reservations table to realtime publication';
  END IF;
END $$;

-- Final verification
SELECT 'Rooms created:' as info, COUNT(*) as count FROM public.rooms
UNION ALL
SELECT 'Reservations created:' as info, COUNT(*) as count FROM public.reservations;

SELECT 'Room numbering:' as info, room_number, type, status, price FROM public.rooms ORDER BY id;
