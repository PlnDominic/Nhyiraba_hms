-- Reset all rooms to Available status
-- Run this script in your Supabase SQL Editor to make all rooms available

-- Update all rooms to Available status
UPDATE public.rooms 
SET status = 'Available', 
    updated_at = NOW()
WHERE status IN ('Reserved', 'Occupied', 'Maintenance', 'Cleaning');

-- Note: guest column doesn't exist in this rooms table structure

-- Update reservations to clear any conflicting statuses
UPDATE public.reservations 
SET status = 'Cancelled', 
    updated_at = NOW()
WHERE status IN ('Reserved', 'Checked In');

-- Verify the changes
SELECT id, room_number, type, status, price 
FROM public.rooms 
ORDER BY room_number;

-- Show count by status
SELECT status, COUNT(*) as count 
FROM public.rooms 
GROUP BY status 
ORDER BY status;
