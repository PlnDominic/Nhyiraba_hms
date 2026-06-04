-- Update Room Pricing and Remove Room 10
-- Run this script in your Supabase SQL Editor to update room prices and remove room 10

-- First, remove room 10 (doesn't exist in this hotel)
DELETE FROM public.rooms WHERE room_number = '10';

-- Update pricing for rooms 1, 2, 3, 5, 6, 7, 8, 9, 11, 12 to 300 cedis
UPDATE public.rooms 
SET price = 300, 
    updated_at = NOW()
WHERE room_number IN ('01', '02', '03', '05', '06', '07', '08', '09', '11', '12');

-- Update pricing for rooms 13, 14, 15 to 250 cedis
UPDATE public.rooms 
SET price = 250, 
    updated_at = NOW()
WHERE room_number IN ('13', '14', '15');

-- Add room 16 (250 cedis)
INSERT INTO public.rooms (id, room_number, type, status, price, capacity, amenities, created_at, updated_at)
VALUES (16, '16', 'Standard', 'Available', 250, 2, ARRAY['WiFi', 'TV', 'AC'], NOW(), NOW());

-- Verify the changes
SELECT id, room_number, type, status, price 
FROM public.rooms 
ORDER BY room_number;

-- Show count by price
SELECT price, COUNT(*) as room_count 
FROM public.rooms 
GROUP BY price 
ORDER BY price;

-- Show total rooms
SELECT COUNT(*) as total_rooms FROM public.rooms;
